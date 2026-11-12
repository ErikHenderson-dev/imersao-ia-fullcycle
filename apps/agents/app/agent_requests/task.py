"""A delegação de Tarefa, que a ferramenta `delegar_tarefa` faz (spec da F12, "O Agente
`assistente`").

O modelo escolhe o Responsável e escreve o título; quem confere que o Responsável é Membro e monta a
confirmação é a API do chat, na ação `task`. Uma recusa do Responsável volta ao modelo, que escreve
a recusa curta; outra falha sobe, e o fim do Pedido grava o "não consegui".
"""

from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.agent_requests.reading import username_of
from app.chat_api import ChatApiClient, ChatApiError

# O motivo de cada recusa do Responsável, para o modelo escrever a recusa curta.
ASSIGNEE_REFUSALS = {
    "assignee_not_member": "Essa Pessoa não é Membro desta Conversa.",
    "assignee_is_bot": "Uma Tarefa não pode ser delegada a um Agente.",
}


async def delegate(
    client: ChatApiClient, tool_context: ToolContext, responsavel: str, titulo: str
) -> dict[str, Any]:
    """Chama a ação `task` e marca o Pedido como respondido; na recusa do Responsável, devolve o
    motivo, sem marcar."""
    username = username_of(responsavel)
    if username is None:
        return {"erro": ASSIGNEE_REFUSALS["assignee_not_member"]}
    try:
        await client.task(tool_context.state[context.REQUEST_ID], username, titulo)
    except ChatApiError as error:
        reason = ASSIGNEE_REFUSALS.get(error.code or "")
        if reason is None:
            raise
        return {"erro": reason}
    # A confirmação já está na Conversa, como a pergunta (`context.mark_answered`).
    context.mark_answered(tool_context, "task")
    return {"tarefa": titulo, "responsavel": username}
