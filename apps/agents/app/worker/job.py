"""O job do Relatório no Worker de agentes (spec da F14, "Worker de agentes").

Sem chamar o modelo: consulta as seis Métricas nos dois períodos, monta o PDF, confere o lastro no
texto dele, grava no S3, audita e entrega pela API do chat, e solta a trava. Sem lastro, grava a
falha e não entrega nada. Os logs levam o id do Pedido, nunca o resultado nem o PDF.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from redis.asyncio import Redis
from sqlalchemy import Select

from app.business import audit
from app.business.catalog import compiled_sql
from app.business.db import BusinessStore
from app.business.lastro import has_lastro
from app.business.readonly import assert_read_only
from app.business.report_queue import ReportJob, release_lock
from app.chat_api import ChatApiClient
from app.worker.metrics import metrics_query, report_rows, values_of
from app.worker.pdf import (
    ReportContent,
    allowed_numbers,
    build_pdf,
    file_name,
    read_pdf,
)
from app.worker.storage import ReportStorage, report_key

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WorkerDeps:
    business: BusinessStore
    chat: ChatApiClient
    storage: ReportStorage
    redis: Redis


async def run_report(deps: WorkerDeps, job: ReportJob, now: datetime) -> None:
    """O Relatório do job, do banco à entrega. `now` é o instante da geração."""
    log = {"extra": {"request_id": job.request_id}}
    catalog_filter = job.filter.catalog() if job.filter else None
    filter_type = job.filter.type if job.filter else None
    filter_name = job.filter.name if job.filter else None
    queries = [
        metrics_query(period, deps.business.time_zone, catalog_filter)
        for period in (job.period, job.previous_period)
    ]
    compiled = [compiled_sql(query) for query in queries]
    # Os dois SQLs compilados, separados por uma linha em branco (spec da F14, "Auditoria").
    sql = "\n\n".join(compiled)
    current, previous = [
        values_of(await _run(deps.business, query, text), catalog_filter)
        for query, text in zip(queries, compiled, strict=True)
    ]
    content = ReportContent(
        period=job.period,
        previous_period=job.previous_period,
        filter_label=f"{filter_type} {filter_name}" if job.filter else None,
        generated_at=now.astimezone(deps.business.time_zone),
        time_zone=deps.business.time_zone.key,
        rows=report_rows(current, previous, catalog_filter),
    )
    # Montar o PDF e extrair o texto dele pesam na CPU: fora do laço do Worker.
    pdf, has_lastro = await asyncio.to_thread(
        _build_and_check, content, job.requested_at, filter_name
    )

    async def record(outcome: audit.Outcome) -> None:
        await deps.business.record(
            request_id=job.request_id,
            requester_id=job.requester_id,
            conversation_id=job.conversation_id,
            question=job.question,
            params=job.to_payload(),
            sql=sql,
            outcome=outcome,
            kind="report",
        )

    if not has_lastro:
        # Um número sem lastro barra o PDF inteiro, sem nova tentativa (ADR 0014).
        logger.warning(
            "Relatório do Pedido %s barrado pelo lastro", job.request_id, **log
        )
        await record("lastro_blocked")
        await deps.chat.report_failed(job.request_id)
        await release_lock(deps.redis, job.requester_id, job.request_id)
        return
    key = report_key(job.request_id)
    await deps.storage.put_pdf(key, pdf)
    # A auditoria antes da entrega: uma falha nela faz a tentativa falhar.
    await record("delivered")
    await deps.chat.report_delivered(
        job.request_id,
        storage_key=key,
        file_name=file_name(job.period, filter_type, filter_name),
        size_bytes=len(pdf),
    )
    await release_lock(deps.redis, job.requester_id, job.request_id)
    logger.info("Relatório do Pedido %s entregue", job.request_id, **log)


def _build_and_check(
    content: ReportContent, created_at: datetime, filter_name: str | None
) -> tuple[bytes, bool]:
    """O PDF e se todo número do texto extraído dele tem lastro."""
    pdf = build_pdf(content, created_at)
    text, pages = read_pdf(pdf)
    return pdf, has_lastro(text, allowed_numbers(content, filter_name, pages))


async def _run(business: BusinessStore, query: Select, sql: str) -> Any:
    """A conferência de somente leitura do SQL compilado e a consulta, pelo usuário só leitura."""
    assert_read_only(sql)
    return await business.fetch_one(query)


async def generate_report(ctx: dict[str, Any], payload: dict[str, Any]) -> None:
    """A função do job no arq."""
    await run_report(ctx["deps"], ReportJob.from_payload(payload), datetime.now(UTC))
