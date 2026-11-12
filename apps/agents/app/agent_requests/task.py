"""A delegação de Tarefa, que a ferramenta `delegar_tarefa` faz (spec da F12, "O Agente
`assistente`").

O modelo escolhe o Responsável e escreve o título; quem confere que o Responsável é Membro e monta a
confirmação é a API do chat, na ação `task`. Uma recusa do Responsável volta ao modelo, que escreve
a recusa curta; outra falha sobe, e o fim do Pedido grava o "não consegui".
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.agent_requests.reading import username_of
from app.chat_api import ChatApiClient, ChatApiError

# O motivo de cada recusa da ação, para o modelo escrever a recusa curta ou corrigir o título.
REFUSALS = {
    "assignee_not_member": "Essa Pessoa não é Membro desta Conversa.",
    "assignee_is_bot": "Uma Tarefa não pode ser delegada a um Agente.",
    "validation_failed": "O título precisa ter de 1 a 120 caracteres; escreva um mais curto.",
}
NOT_MENTIONED = (
    "O Responsável precisa ser mencionado no pedido com @, ou ser quem pediu; não delegue a outra "
    "Pessoa."
)

# Sem resposta ou com erro do servidor, a ação pode ter sido gravada: repetir é seguro, porque a
# ação `task` é idempotente, e evita um "não consegui" ao lado de uma Tarefa já criada.
ATTEMPTS = 2


async def delegate(
    client: ChatApiClient, tool_context: ToolContext, responsavel: str, titulo: str
) -> dict[str, Any]:
    """Chama a ação `task` e marca o Pedido como respondido; na recusa do Responsável, devolve o
    motivo, sem marcar."""
    username = username_of(responsavel)
    if username is None:
        return {"erro": REFUSALS["assignee_not_member"]}
    # O Responsável vem do pedido: uma Menção ou quem pediu, nunca do texto citado (F12-T05).
    if username not in allowed_assignees(tool_context.state):
        return {"erro": NOT_MENTIONED}
    request_id = tool_context.state[context.REQUEST_ID]
    for attempt in range(1, ATTEMPTS + 1):
        try:
            await client.task(request_id, username, titulo)
            break
        except ChatApiError as error:
            reason = REFUSALS.get(error.code or "")
            if reason is not None:
                return {"erro": reason}
            retriable = error.status is None or error.status >= 500
            if not retriable or attempt == ATTEMPTS:
                raise
    # A confirmação já está na Conversa, como a pergunta (`context.mark_answered`).
    context.mark_answered(tool_context, "task")
    return {"tarefa": titulo, "responsavel": username}


def allowed_assignees(state: Mapping[str, Any]) -> set[str]:
    """Os @usuário que podem ser o Responsável: os mencionados no pedido e quem pediu."""
    mentioned = {mention["username"] for mention in state.get(context.MENTIONS) or []}
    requester = state.get(context.REQUESTER_USERNAME)
    return mentioned | ({requester} if requester else set())
