"""As ferramentas do `assistente` (spec da F11, "O Agente `assistente`").

O modelo escolhe o Recorte e, com a Menção no pedido, a Pessoa; a data, a leitura, a contagem e os
botões são do código. O Pedido, o fuso e o instante vêm do estado da sessão, que o modelo não vê.
"""

from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.agent_requests.question import QUESTION_BODY, question_asked, recorte_options
from app.agent_requests.reading import ChatApiSource, read_recorte
from app.agent_requests.recorte import Recorte
from app.chat_api import CURRENT_CHAT_API

FORA_DE_UM_PEDIDO = "A ferramenta só funciona dentro de um Pedido."


async def ler_mensagens(
    recorte: Recorte, tool_context: ToolContext, pessoa: str | None = None
) -> dict[str, Any]:
    """Lê as Mensagens de Pessoas desta Conversa no Recorte pedido.

    Args:
        recorte: O período. "hoje" (desde a meia-noite de hoje), "desde_ontem" (desde a
            meia-noite de ontem), "semana" (os últimos 7 dias) ou "tudo" (todo o histórico).
        pessoa: Só quando o pedido menciona a Pessoa com @: o @usuário dela (por exemplo,
            "bruno"). Sem Menção, omita este argumento.

    Returns:
        O Recorte, o período em hora local, a Pessoa, o `total` de Mensagens do Recorte, quantas
        foram lidas (`cobertas`, no máximo as 500 mais recentes) e as `mensagens`, da mais antiga
        para a mais nova, com o nome do autor, o texto e a hora.
    """
    client = CURRENT_CHAT_API.get()
    if client is None:
        return {"erro": FORA_DE_UM_PEDIDO}
    source = ChatApiSource(client, tool_context.state[context.REQUEST_ID])
    return await read_recorte(source, tool_context.state, recorte, pessoa)


async def perguntar_recorte(tool_context: ToolContext) -> dict[str, Any]:
    """Pergunta a quem pediu qual período resumir, com um botão por período e a quantidade de
    Mensagens de cada um. Use só num pedido de resumo sem período, Pessoa nem assunto. Depois dela,
    não escreva nada: a pergunta já está na Conversa.

    Returns:
        A pergunta gravada e os rótulos dos botões.
    """
    if tool_context.state.get(context.KIND) == "continuation":
        # A continuação já é a resposta a uma pergunta: não pergunta de novo (spec da F11).
        return {
            "erro": "Esta Mensagem já responde a uma pergunta; não pergunte de novo."
        }
    client = CURRENT_CHAT_API.get()
    if client is None:
        return {"erro": FORA_DE_UM_PEDIDO}
    request_id = tool_context.state[context.REQUEST_ID]
    options = await recorte_options(
        ChatApiSource(client, request_id), tool_context.state
    )
    await client.question(request_id, QUESTION_BODY, options)
    return question_asked(tool_context, options)
