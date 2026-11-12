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

from arq import Retry
from redis.asyncio import Redis
from sqlalchemy import Select

from app.business import audit
from app.business.catalog import compiled_sql
from app.business.db import BusinessStore
from app.business.lastro import has_lastro
from app.business.readonly import assert_read_only
from app.business.report_queue import ReportJob, release_lock
from app.chat_api import ChatApiClient, ChatApiError
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
    rows = await asyncio.gather(
        *(
            _run(deps.business, query, text)
            for query, text in zip(queries, compiled, strict=True)
        )
    )
    current, previous = [values_of(row, catalog_filter) for row in rows]
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
        await _record(deps, job, outcome, sql)

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


# As novas tentativas (LLD, "Valores e configuração"): `tentativas do Worker`, a espera antes da
# segunda e da terceira e o tempo limite de cada tentativa. O arq marca o job estourado como falho,
# sem nova tentativa: o tempo limite é do próprio job.
MAX_TRIES = 3
RETRY_DELAYS_S = (5, 15)
ATTEMPT_TIMEOUT_S: float = 20

# A API do chat diz que o Pedido acabou: o job termina sem nova tentativa.
REQUEST_GONE_STATUS = frozenset({404, 410})
REQUEST_GONE_CODES = frozenset(
    {"request_closed", "request_expired", "request_not_found"}
)


def request_gone(error: ChatApiError) -> bool:
    return error.status in REQUEST_GONE_STATUS or error.code in REQUEST_GONE_CODES


async def generate_report(ctx: dict[str, Any], payload: dict[str, Any]) -> None:
    """A função do job no arq: uma tentativa com o tempo limite; a que falha volta à fila com a
    espera da vez dela, e a última grava a falha (spec da F14, "Fila e job")."""
    deps: WorkerDeps = ctx["deps"]
    job = ReportJob.from_payload(payload)
    job_try: int = ctx.get("job_try", 1)
    log = {"extra": {"request_id": job.request_id}}
    try:
        await asyncio.wait_for(
            run_report(deps, job, datetime.now(UTC)), timeout=ATTEMPT_TIMEOUT_S
        )
    except ChatApiError as error:
        if not request_gone(error):
            await _retry_or_fail(deps, job, job_try, error)
            return
        # O Pedido acabou: sem nova tentativa nem "não consegui", só o log e a trava solta.
        logger.warning(
            "Pedido %s recusou o Relatório (%s); job encerrado",
            job.request_id,
            error.status,
            **log,
        )
        await release_lock(deps.redis, job.requester_id, job.request_id)
    except Exception as error:
        await _retry_or_fail(deps, job, job_try, error)


async def _retry_or_fail(
    deps: WorkerDeps, job: ReportJob, job_try: int, error: Exception
) -> None:
    log = {"extra": {"request_id": job.request_id}}
    if job_try < MAX_TRIES:
        logger.warning(
            "Tentativa %s do Relatório do Pedido %s falhou: %s",
            job_try,
            job.request_id,
            type(error).__name__,
            **log,
        )
        raise Retry(defer=RETRY_DELAYS_S[job_try - 1]) from error
    logger.error(
        "Relatório do Pedido %s falhou nas %s tentativas: %s",
        job.request_id,
        MAX_TRIES,
        type(error).__name__,
        **log,
    )
    # A trava primeiro; a auditoria e a falha depois, cada uma sem impedir a outra.
    await release_lock(deps.redis, job.requester_id, job.request_id)
    for step in (
        _record(deps, job, "error", None),
        deps.chat.report_failed(job.request_id),
    ):
        try:
            await step
        except Exception as step_error:
            logger.error(
                "Falha final do Relatório do Pedido %s incompleta: %s",
                job.request_id,
                type(step_error).__name__,
                **log,
            )


async def _record(
    deps: WorkerDeps, job: ReportJob, outcome: audit.Outcome, sql: str | None
) -> None:
    """A linha de auditoria do Relatório (spec da F14, "Auditoria"), nunca o resultado nem o PDF."""
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
