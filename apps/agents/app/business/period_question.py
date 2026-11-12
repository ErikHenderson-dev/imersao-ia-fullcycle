"""A pergunta de período da consulta a Dados de negócio (spec da F13, "O Agente `assistente`",
`perguntar_periodo`).

Sem a marca, porque não revela dado, e sem auditoria, porque não toca o banco. Como as outras
ferramentas de pergunta, recusa rodar numa continuação (`ask_question`).
"""

from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

from app.agent_requests.question import ask_question
from app.chat_api import ChatApiClient

PERIOD_QUESTION = "De que período?"
PERIOD_OPTIONS = ["Este mês", "Mês passado", "Este ano"]


async def ask_period(
    client: ChatApiClient, tool_context: ToolContext
) -> dict[str, Any]:
    return await ask_question(client, tool_context, PERIOD_QUESTION, PERIOD_OPTIONS)
