"""O pedido de Relatório em PDF, que a ferramenta `gerar_relatorio` faz (spec da F14, "Ferramenta
`gerar_relatorio`").

O modelo só escolhe o período e, se o pedido nomeia, o cliente, o vendedor ou o produto; o código
confere a Permissão de dados, os parâmetros e a trava de um
Relatório por vez, calcula o período anterior, grava o Aviso de início e só então põe o job na
fila. A entrega e a falha chegam depois, pelo Worker. Cada passo que recusa encerra o Pedido.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from datetime import date, datetime
from typing import Any

from arq import ArqRedis
from google.adk.tools import ToolContext

from app.agent_requests import context
from app.business import audit
from app.business.answer import SEM_PERMISSAO
from app.business.catalog import Period
from app.business.consult import DONE, parse_filter, parse_period, resolve_name
from app.business.db import BusinessStore
from app.business.periods import report_periods
from app.business.report_queue import (
    ReportFilter,
    ReportJob,
    acquire_lock,
    enqueue_report,
    lock_owner,
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


async def request_report(
    client: ChatApiClient,
    store: BusinessStore,
    queue: ArqRedis,
    tool_context: ToolContext,
    inicio: str,
    fim: str,
    filtro_tipo: str | None = None,
    filtro_nome: str | None = None,
) -> dict[str, Any]:
    state = tool_context.state
    request_id = state[context.REQUEST_ID]
    requester_id = state[context.REQUESTER_ID]
    params = {
        "inicio": inicio,
        "fim": fim,
        "filtro_tipo": filtro_tipo,
        "filtro_nome": filtro_nome,
    }

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

    # A ferramenta já atendeu este Pedido (o aviso, uma recusa ou uma pergunta): nada a fazer.
    answered = state.get(context.ANSWERED_BY_TOOL)
    if answered and answered.get("pedido") == request_id:
        return DONE
    # 1. A Permissão de dados, no código, antes da trava e do banco (ADR 0015).
    if not state.get(context.DATA_ACCESS):
        await record("no_permission")
        return await refuse(SEM_PERMISSAO)
    # 2. Os parâmetros inválidos voltam ao modelo, sem auditoria.
    parsed = parse_period(inicio, fim)
    if isinstance(parsed, str):
        return {"erro": parsed}
    today = date.fromisoformat(state[context.BUSINESS_TODAY])
    if parsed.start > today:
        return {"erro": "O período ainda não começou: o início precisa ser até hoje."}
    name = parse_filter(filtro_tipo, filtro_nome)
    if isinstance(name, dict):
        return name
    # 3. Um Relatório por vez, por Pessoa: sem auditoria, porque não toca o banco. A trava presa
    # por este mesmo Pedido é outra chamada da ferramenta, em paralelo: ela volta ao modelo, sem
    # gravar nada nem marcar o desfecho, e a primeira segue.
    if not await acquire_lock(queue, requester_id, request_id):
        if await lock_owner(queue, requester_id) == request_id:
            return {"erro": "Um Relatório deste pedido já está sendo gerado; não chame de novo."}
        return await refuse(REPORT_IN_PROGRESS)
    # Até o aviso, qualquer falha solta a trava: sem aviso, nenhum job a soltaria.
    try:
        job = await _job(
            client, store, queue, tool_context, record, parsed, today, filtro_tipo, name
        )
        if isinstance(job, dict):
            return job
        # 6. O Aviso de início, que estende a validade do Pedido, e só depois o job na fila: a
        # entrega nunca chega antes do aviso.
        label = f"{job.filter.type} {job.filter.name}" if job.filter else None
        await client.report_started(request_id, notice_text(job.period, label))
    except Exception:
        await release_lock(queue, requester_id, request_id)
        raise
    context.mark_answered(tool_context, "report")
    try:
        await enqueue_report(queue, job)
    except Exception as error:
        # 7. Sem o job, a trava solta primeiro, a auditoria e a falha depois.
        logger.warning(
            "Relatório do Pedido %s não entrou na fila: %s",
            request_id,
            type(error).__name__,
            extra={"request_id": request_id},
        )
        await release_lock(queue, requester_id, request_id)
        await record("error")
        await client.report_failed(request_id)
    return DONE


async def _job(
    client: ChatApiClient,
    store: BusinessStore,
    queue: ArqRedis,
    tool_context: ToolContext,
    record: Callable[[audit.Outcome], Awaitable[None]],
    parsed: Period,
    today: date,
    filtro_tipo: str | None,
    name: str | None,
) -> ReportJob | dict[str, Any]:
    """O job do Relatório, ou a saída de nome já gravada na Conversa (passos 4 e 5)."""
    state = tool_context.state
    request_id = state[context.REQUEST_ID]
    requester_id = state[context.REQUESTER_ID]
    # 4. O nome do filtro, pela busca da F13; cada saída solta a trava antes de gravar.
    filter = None
    if filtro_tipo and name:

        async def record_released(outcome: audit.Outcome, _sql: str | None) -> None:
            await release_lock(queue, requester_id, request_id)
            await record(outcome)

        async def finish_released(
            outcome: audit.Outcome, text: str, *, sql: str | None, business_data: bool
        ) -> dict[str, Any]:
            await record_released(outcome, sql)
            await client.reply(request_id, text, business_data=business_data)
            context.mark_answered(tool_context, "report")
            return DONE

        resolved = await resolve_name(
            store,
            tool_context,
            client,
            record_released,
            finish_released,
            filtro_tipo,
            name,
        )
        if isinstance(resolved, dict):
            return resolved
        found, full_name = resolved
        filter = ReportFilter(found.kind, found.id, full_name)
    # 5. O período anterior, em código, a partir de hoje no fuso da empresa.
    period, previous = report_periods(parsed.start, parsed.end, today)
    return ReportJob(
        request_id=request_id,
        requester_id=requester_id,
        conversation_id=state[context.CONVERSATION_ID],
        question=state.get(context.QUESTION) or "",
        period=period,
        previous_period=previous,
        filter=filter,
        requested_at=datetime.fromisoformat(state[context.REQUESTED_AT]),
    )
