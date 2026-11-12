"""A pergunta da delegação incompleta, que a ferramenta `perguntar_delegacao` faz (spec da F12, "O
Agente `assistente`").

O texto e os rótulos são do código, como na pergunta de Recorte: o modelo só escolhe o que falta e,
com dois ou mais mencionados, os candidatos.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Literal

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.agent_requests.reading import username_of
from app.chat_api import ChatApiClient

Falta = Literal["responsavel", "o_que", "qual"]

QUESTIONS: dict[str, str] = {
    "responsavel": "A quem eu delego?",
    "o_que": "O que devo delegar?",
    "qual": "Para quem é a Tarefa?",
}
# Os limites das Respostas prontas na API do chat (spec da F11, "Rotas do bot e credencial").
MAX_OPTIONS = 4
MAX_LABEL_LENGTH = 64

NAO_PERGUNTE = "Esta Mensagem já responde a uma pergunta; não pergunte de novo."


def candidate_labels(
    candidatos: Sequence[str], mentions: Sequence[Mapping[str, str]]
) -> list[tuple[str, str]]:
    """Os rótulos dos candidatos que estão entre as Pessoas mencionadas, na ordem, no máximo quatro:
    o nome, com o @usuário sem arroba entre parênteses quando dois têm o mesmo nome. O rótulo nunca
    leva `@`, para o clique não virar Menção."""
    by_username = {mention["username"]: mention["name"] for mention in mentions}
    picked: list[tuple[str, str]] = []
    for candidato in candidatos:
        username = username_of(candidato)
        if (
            username
            and username in by_username
            and username not in {u for _, u in picked}
        ):
            picked.append((by_username[username], username))
    picked = picked[:MAX_OPTIONS]
    names = [name for name, _ in picked]
    labels = []
    for name, username in picked:
        label = f"{name} ({username})" if names.count(name) > 1 else name
        labels.append((label.replace("@", "")[:MAX_LABEL_LENGTH], username))
    return labels


async def ask_delegation(
    client: ChatApiClient,
    tool_context: ToolContext,
    falta: Falta,
    candidatos: Sequence[str] | None,
) -> dict[str, Any]:
    """Grava a pergunta do que falta e marca o Pedido como respondido pela ferramenta. Numa
    continuação não pergunta: ela já responde a uma pergunta."""
    if tool_context.state.get(context.KIND) == "continuation":
        return {"erro": NAO_PERGUNTE}
    labels = (
        candidate_labels(
            candidatos or [], tool_context.state.get(context.MENTIONS) or []
        )
        if falta == "qual"
        else []
    )
    body = QUESTIONS[falta]
    await client.question(
        tool_context.state[context.REQUEST_ID], body, [label for label, _ in labels]
    )
    context.mark_answered(tool_context, "question")
    return {
        "pergunta": body,
        "candidatos": [
            {"rotulo": label, "usuario": username} for label, username in labels
        ],
    }
