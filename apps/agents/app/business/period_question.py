"""A pergunta de período da consulta a Dados de negócio (spec da F13, "O Agente `assistente`",
`perguntar_periodo`).

Sem a marca, porque não revela dado, e sem auditoria, porque não toca o banco. Como as outras
ferramentas de pergunta, recusa rodar numa continuação, que já responde a uma pergunta.
"""

from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.agent_requests.question import NAO_PERGUNTE, ask_question
from app.chat_api import ChatApiClient

PERIOD_QUESTION = "De que período?"
PERIOD_OPTIONS = ["Este mês", "Mês passado", "Este ano"]


async def ask_period(
    client: ChatApiClient, tool_context: ToolContext
) -> dict[str, Any]:
    if tool_context.state.get(context.KIND) == "continuation":
        return {"erro": NAO_PERGUNTE}
    return await ask_question(client, tool_context, PERIOD_QUESTION, PERIOD_OPTIONS)
