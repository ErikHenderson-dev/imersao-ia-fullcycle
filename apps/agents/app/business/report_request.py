"""O pedido de Relatório em PDF, que a ferramenta `gerar_relatorio` faz (spec da F14, "Ferramenta
`gerar_relatorio`").

O modelo só escolhe o período; o código confere a Permissão de dados, os parâmetros e a trava de um
Relatório por vez, calcula o período anterior, grava o Aviso de início e só então põe o job na
fila. A entrega e a falha chegam depois, pelo Worker. Cada passo que recusa encerra o Pedido.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from typing import Any

from arq import ArqRedis
from google.adk.tools import ToolContext

from app.agent_requests import context
from app.business import audit
from app.business.answer import SEM_PERMISSAO
from app.business.catalog import Period
from app.business.consult import DONE
from app.business.db import BusinessStore
from app.business.periods import report_periods
from app.business.report_queue import (
    ReportFilter,
    ReportJob,
    acquire_lock,
    enqueue_report,
    release_lock,
)
from app.chat_api import ChatApiClient

logger = logging.getLogger(__name__)

REPORT_IN_PROGRESS = (
    "Já tem um relatório seu sendo gerado. Ele chega na conversa onde foi pedido."
)


def notice_text(period: Period, filter_label: str | None = None) -> str:
    """O Aviso de início: as datas do período (já cortado em hoje) e o filtro, se houver."""
    dates = f"de {period.start:%d/%m/%Y} a {period.end:%d/%m/%Y}"
    scope = f"{dates}, {filter_label}" if filter_label else dates
    return f"Comecei a gerar o relatório {scope}. Ele chega aqui quando ficar pronto."


def _parse(inicio: str, fim: str) -> tuple[date, date] | dict[str, str]:
    try:
        start, end = date.fromisoformat(inicio or ""), date.fromisoformat(fim or "")
    except ValueError:
        return {"erro": "As datas precisam estar no formato AAAA-MM-DD."}
    if start > end:
        return {"erro": "O início precisa ser antes do fim."}
    return start, end


async def request_report(
    client: ChatApiClient,
    store: BusinessStore,
    queue: ArqRedis,
    tool_context: ToolContext,
    inicio: str,
    fim: str,
) -> dict[str, Any]:
    state = tool_context.state
    request_id = state[context.REQUEST_ID]
    requester_id = state[context.REQUESTER_ID]
    params = {"inicio": inicio, "fim": fim}

    async def record(outcome: audit.Outcome) -> None:
        await store.record(
            request_id=request_id,
            requester_id=requester_id,
            conversation_id=state[context.CONVERSATION_ID],
            question=state.get(context.QUESTION) or "",
            params=params,
            sql=None,
            outcome=outcome,
            kind="report",
        )

    async def refuse(text: str) -> dict[str, Any]:
        await client.reply(request_id, text, business_data=False)
        context.mark_answered(tool_context, "report")
        return DONE

    # 1. A Permissão de dados, no código, antes da trava e do banco (ADR 0015).
    if not state.get(context.DATA_ACCESS):
        await record("no_permission")
        return await refuse(SEM_PERMISSAO)
    # 2. Os parâmetros inválidos voltam ao modelo, sem auditoria.
    parsed = _parse(inicio, fim)
    if isinstance(parsed, dict):
        return parsed
    # 3. Um Relatório por vez, por Pessoa: sem auditoria, porque não toca o banco.
    if not await acquire_lock(queue, requester_id, request_id):
        return await refuse(REPORT_IN_PROGRESS)
    # 5. O período anterior, em código, a partir de hoje no fuso da empresa.
    today = date.fromisoformat(state[context.BUSINESS_TODAY])
    period, previous = report_periods(*parsed, today)
    job = ReportJob(
        request_id=request_id,
        requester_id=requester_id,
        conversation_id=state[context.CONVERSATION_ID],
        question=state.get(context.QUESTION) or "",
        period=period,
        previous_period=previous,
        filter=None,
        requested_at=_requested_at(state),
    )
    return await _start(client, queue, tool_context, job, None, record)


async def _start(
    client: ChatApiClient,
    queue: ArqRedis,
    tool_context: ToolContext,
    job: ReportJob,
    filter: ReportFilter | None,
    record: Any,
) -> dict[str, Any]:
    """6. O Aviso de início, que estende a validade do Pedido, e só depois o job na fila: a entrega
    nunca chega antes do aviso. 7. Se enfileirar falha, a falha e a trava solta."""
    label = f"{filter.type} {filter.name}" if filter else None
    await client.report_started(job.request_id, notice_text(job.period, label))
    context.mark_answered(tool_context, "report")
    try:
        await enqueue_report(queue, job)
    except Exception as error:
        logger.warning(
            "Relatório do Pedido %s não entrou na fila: %s",
            job.request_id,
            type(error).__name__,
            extra={"request_id": job.request_id},
        )
        await record("error")
        await client.report_failed(job.request_id)
        await release_lock(queue, job.requester_id, job.request_id)
    return DONE


def _requested_at(state: Any) -> datetime:
    raw = state.get(context.REQUESTED_AT)
    return datetime.fromisoformat(raw) if raw else datetime.now(UTC)
