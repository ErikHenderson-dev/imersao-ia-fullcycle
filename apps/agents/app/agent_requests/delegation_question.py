"""A pergunta da delegação incompleta, que a ferramenta `perguntar_delegacao` faz (spec da F12, "O
Agente `assistente`").

O texto e os rótulos são do código, como na pergunta de Recorte: o modelo só escolhe o que falta e,
com dois ou mais mencionados, os candidatos.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Mapping, Sequence
from typing import Any, Literal

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.agent_requests.question import (
    MAX_QUICK_REPLIES,
    MAX_QUICK_REPLY_LENGTH,
    NAO_PERGUNTE,
)
from app.agent_requests.reading import username_of
from app.chat_api import ChatApiClient

Falta = Literal["responsavel", "o_que", "qual"]

QUESTIONS: dict[str, str] = {
    "responsavel": "A quem eu delego?",
    "o_que": "O que devo delegar?",
    "qual": "Para quem é a Tarefa?",
}


def candidate_labels(
    candidatos: Sequence[str], mentions: Sequence[Mapping[str, str]]
) -> list[tuple[str, str]]:
    """Os rótulos dos candidatos que estão entre as Pessoas mencionadas, na ordem, no máximo quatro:
    o nome, com o @usuário sem arroba entre parênteses quando dois têm o mesmo nome. O rótulo nunca
    leva `@`, para o clique não virar Menção."""
    by_username = {mention["username"]: mention["name"] for mention in mentions}
    picked: list[tuple[str, str]] = []
    seen: set[str] = set()
    for candidato in candidatos:
        username = username_of(candidato)
        if not username or username not in by_username or username in seen:
            continue
        seen.add(username)
        picked.append((by_username[username], username))
        if len(picked) == MAX_QUICK_REPLIES:
            break
    repeated = Counter(name for name, _ in picked)
    labels = []
    for name, username in picked:
        clean = name.replace("@", "")
        if repeated[name] > 1:
            # O nome é cortado antes do @usuário, para os rótulos repetidos continuarem distintos.
            suffix = f" ({username})"
            label = clean[: MAX_QUICK_REPLY_LENGTH - len(suffix)] + suffix
        else:
            label = clean[:MAX_QUICK_REPLY_LENGTH]
        labels.append((label, username))
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
    if falta not in QUESTIONS:
        return {"erro": 'falta precisa ser "responsavel", "o_que" ou "qual".'}
    mentions = tool_context.state.get(context.MENTIONS) or []
    labels = candidate_labels(candidatos or [], mentions) if falta == "qual" else []
    if falta == "qual" and len(labels) < 2:
        return {
            "erro": "Com qual, passe em candidatos os @usuário de dois ou mais mencionados."
        }
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
