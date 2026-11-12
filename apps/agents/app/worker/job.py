"""O job do Relatório no Worker de agentes (spec da F14, "Worker de agentes").

Sem chamar o modelo: consulta as seis Métricas nos dois períodos, monta o PDF, confere o lastro no
texto dele, grava no S3, audita e entrega pela API do chat, e solta a trava. Sem lastro, grava a
falha e não entrega nada. Os logs levam o id do Pedido, nunca o resultado nem o PDF.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from redis.asyncio import Redis
from sqlalchemy import Select

from app.business import audit
from app.business.catalog import compiled_sql
from app.business.db import BusinessStore
from app.business.readonly import assert_read_only
from app.business.report_queue import ReportJob, release_lock
from app.chat_api import ChatApiClient
from app.worker.metrics import metrics_query, report_rows, values_of
from app.worker.pdf import (
    ReportContent,
    allowed_numbers,
    build_pdf,
    file_name,
    has_pdf_lastro,
    page_count,
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
    queries = [
        metrics_query(period, deps.business.time_zone, catalog_filter)
        for period in (job.period, job.previous_period)
    ]
    # Os dois SQLs compilados, separados por uma linha em branco (spec da F14, "Auditoria").
    sql = "\n\n".join(compiled_sql(query) for query in queries)
    current, previous = [
        values_of(await _run(deps.business, query), catalog_filter) for query in queries
    ]
    content = ReportContent(
        period=job.period,
        previous_period=job.previous_period,
        filter_label=f"{job.filter.type} {job.filter.name}" if job.filter else None,
        generated_at=now.astimezone(deps.business.time_zone),
        time_zone=deps.business.time_zone.key,
        rows=report_rows(current, previous, catalog_filter),
    )
    pdf = build_pdf(content, job.requested_at)
    allowed = allowed_numbers(
        content, job.filter.name if job.filter else None, page_count(pdf)
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

    if not has_pdf_lastro(pdf, allowed):
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
        file_name=file_name(
            job.period,
            job.filter.type if job.filter else None,
            job.filter.name if job.filter else None,
        ),
        size_bytes=len(pdf),
    )
    await release_lock(deps.redis, job.requester_id, job.request_id)
    logger.info("Relatório do Pedido %s entregue", job.request_id, **log)


async def _run(business: BusinessStore, query: Select) -> Any:
    """A conferência de somente leitura e a consulta, pelo usuário só leitura."""
    assert_read_only(compiled_sql(query))
    return await business.fetch_one(query)


async def generate_report(ctx: dict[str, Any], payload: dict[str, Any]) -> None:
    """A função do job no arq."""
    await run_report(ctx["deps"], ReportJob.from_payload(payload), datetime.now(UTC))
