"""A consulta a Dados de negócio, que a ferramenta `consultar_dados` faz (spec da F13, "O Agente
`assistente`").

O modelo só escolhe a Métrica e as datas; o código confere a Permissão de dados antes de tocar o
banco, monta o SQL, confere que só lê, consulta com o usuário só leitura, escreve o texto, confere o
lastro, grava a auditoria e só então a `reply`. A Permissão de dados vem do estado do Pedido, que o
modelo não vê.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.business import audit
from app.business.answer import (
    NAO_CONSEGUI_RESPONDER,
    SEM_PERMISSAO,
    allowed_numbers,
    answer_text,
    rounded,
)
from app.business.catalog import METRICS, Period, compiled_sql, query_for
from app.business.db import BusinessStore
from app.business.lastro import has_lastro
from app.business.readonly import assert_read_only
from app.chat_api import ChatApiClient

logger = logging.getLogger(__name__)

# A ferramenta gravou a resposta: o fim do Pedido não grava outra `reply`.
DONE = {"resposta": "gravada na Conversa; não escreva nada"}


def parse_params(
    metrica: str, inicio: str, fim: str, bruto: bool
) -> Period | dict[str, str]:
    """O período, ou o `erro` que volta ao modelo, sem consulta."""
    if metrica not in METRICS:
        return {
            "erro": f"Métrica fora do catálogo: use uma de {', '.join(sorted(METRICS))}."
        }
    try:
        period = Period(date.fromisoformat(inicio), date.fromisoformat(fim))
    except ValueError:
        return {"erro": "As datas precisam estar no formato AAAA-MM-DD."}
    if period.start > period.end:
        return {"erro": "O início precisa ser antes do fim."}
    if bruto and metrica != "faturamento":
        return {"erro": "`bruto` só vale para o faturamento."}
    return period


async def consult(
    client: ChatApiClient,
    store: BusinessStore,
    tool_context: ToolContext,
    metrica: str,
    inicio: str,
    fim: str,
    bruto: bool = False,
) -> dict[str, Any]:
    state = tool_context.state
    request_id = state[context.REQUEST_ID]
    params = {"metrica": metrica, "inicio": inicio, "fim": fim, "bruto": bruto}

    async def finish(
        outcome: audit.Outcome, text: str, *, sql: str | None, business_data: bool
    ) -> dict[str, Any]:
        await audit.record(
            store.agents,
            request_id=request_id,
            requester_id=state[context.REQUESTER_ID],
            conversation_id=state[context.CONVERSATION_ID],
            question=state.get(context.QUESTION) or "",
            params=params,
            sql=sql,
            outcome=outcome,
        )
        await client.reply(request_id, text, business_data=business_data)
        context.mark_answered(tool_context, "business")
        return DONE

    # A Permissão de dados é conferida no código, antes de tocar o banco (ADR 0015).
    if not state.get(context.DATA_ACCESS):
        return await finish(
            "no_permission", SEM_PERMISSAO, sql=None, business_data=False
        )
    period = parse_params(metrica, inicio, fim, bruto)
    if isinstance(period, dict):
        return period
    query = query_for(metrica, period, store.time_zone, gross=bruto)
    sql = compiled_sql(query.statement)
    try:
        assert_read_only(sql)
        row = await store.fetch_one(query.statement)
    except Exception as error:
        # O tempo limite, o banco fora ou a conferência: sem número, "não consegui responder".
        logger.warning(
            "Consulta do Pedido %s falhou: %s",
            request_id,
            type(error).__name__,
            extra={"request_id": request_id},
        )
        return await finish(
            "error", NAO_CONSEGUI_RESPONDER, sql=sql, business_data=False
        )
    value = None if row.base == 0 or row.value is None else rounded(metrica, row.value)
    text = answer_text(
        metrica, period, query.window, value, store.time_zone.key, gross=bruto
    )
    if not has_lastro(text, allowed_numbers([value], period, query.window)):
        return await finish(
            "lastro_blocked", NAO_CONSEGUI_RESPONDER, sql=sql, business_data=False
        )
    return await finish("answered", text, sql=sql, business_data=True)
