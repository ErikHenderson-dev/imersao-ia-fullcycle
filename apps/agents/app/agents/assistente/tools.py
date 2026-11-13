"""As ferramentas do `assistente` (specs da F11 e da F12, "O Agente `assistente`").

O modelo escolhe o Recorte e, com a Menção no pedido, a Pessoa; a data, a leitura, a contagem e os
botões são do código. O Pedido, o fuso e o instante vêm do estado da sessão, que o modelo não vê.
"""

from __future__ import annotations

from typing import Any

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.agent_requests.delegation_question import Falta, ask_delegation
from app.agent_requests.question import (
    NAO_PERGUNTE,
    QUESTION_BODY,
    question_asked,
    recorte_options,
)
from app.agent_requests.reading import ChatApiSource, read_recorte
from app.agent_requests.recorte import Recorte
from app.agent_requests.task import delegate
from app.business.consult import consult
from app.business.db import CURRENT_BUSINESS
from app.business.period_question import ask_period
from app.business.report_queue import CURRENT_REPORTS
from app.business.report_request import request_report
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
        return {"erro": NAO_PERGUNTE}
    client = CURRENT_CHAT_API.get()
    if client is None:
        return {"erro": FORA_DE_UM_PEDIDO}
    request_id = tool_context.state[context.REQUEST_ID]
    options = await recorte_options(
        ChatApiSource(client, request_id), tool_context.state
    )
    await client.question(request_id, QUESTION_BODY, options)
    return question_asked(tool_context, options)


async def delegar_tarefa(
    responsavel: str, titulo: str, tool_context: ToolContext
) -> dict[str, Any]:
    """Delega uma Tarefa a um Membro desta Conversa e grava a confirmação na Conversa. Depois dela,
    não escreva nada: a confirmação já está na Conversa.

    Args:
        responsavel: O @usuário do Responsável, sem a arroba (por exemplo, "bruno"). Para "mim",
            "me" ou "eu", o @usuário de quem pediu.
        titulo: O que fazer, em até 120 caracteres, só com o que está no pedido, sem @usuário.

    Returns:
        A Tarefa delegada, ou `erro` com o motivo da recusa do Responsável.
    """
    client = CURRENT_CHAT_API.get()
    if client is None:
        return {"erro": FORA_DE_UM_PEDIDO}
    return await delegate(client, tool_context, responsavel, titulo)


async def perguntar_delegacao(
    falta: Falta, tool_context: ToolContext, candidatos: list[str] | None = None
) -> dict[str, Any]:
    """Pergunta a quem pediu o que falta para delegar a Tarefa. Depois dela, não escreva nada: a
    pergunta já está na Conversa.

    Args:
        falta: "responsavel" (sem Responsável), "o_que" (sem o que fazer, inclusive "isso" sem
            Citação) ou "qual" (dois ou mais mencionados como possíveis Responsáveis).
        candidatos: Só com "qual": os @usuário dos mencionados que podem ser o Responsável.

    Returns:
        A pergunta gravada e, com "qual", o rótulo e o @usuário de cada candidato.
    """
    client = CURRENT_CHAT_API.get()
    if client is None:
        return {"erro": FORA_DE_UM_PEDIDO}
    return await ask_delegation(client, tool_context, falta, candidatos)


async def consultar_dados(
    metrica: str,
    inicio: str,
    fim: str,
    tool_context: ToolContext,
    bruto: bool = False,
    comparar_inicio: str | None = None,
    comparar_fim: str | None = None,
    filtro_tipo: str | None = None,
    filtro_nome: str | None = None,
) -> dict[str, Any]:
    """Consulta um número de vendas do negócio e grava a resposta na Conversa, com o número e o que
    foi considerado. Depois dela, não escreva nada: a resposta (ou a pergunta de qual nome) já está
    na Conversa.

    Args:
        metrica: "faturamento", "pedidos", "ticket_medio", "clientes_ativos", "clientes_novos" ou
            "itens_vendidos".
        inicio: O primeiro dia do período, em AAAA-MM-DD.
        fim: O último dia do período, em AAAA-MM-DD (inclusive).
        bruto: Só no faturamento, quando o pedido fala em faturamento bruto.
        comparar_inicio: Só numa comparação ("março contra fevereiro"): o primeiro dia do período
            comparado, em AAAA-MM-DD.
        comparar_fim: Só numa comparação: o último dia do período comparado (inclusive).
        filtro_tipo: Só quando o pedido nomeia um cliente, vendedor ou produto: "cliente",
            "vendedor" ou "produto".
        filtro_nome: O nome como está no pedido (por exemplo, "Ana"), junto de `filtro_tipo`.

    Returns:
        A confirmação de que a resposta foi gravada, ou `erro` com o parâmetro a corrigir.
    """
    client = CURRENT_CHAT_API.get()
    store = CURRENT_BUSINESS.get()
    if client is None or store is None:
        return {"erro": FORA_DE_UM_PEDIDO}
    return await consult(
        client,
        store,
        tool_context,
        metrica,
        inicio,
        fim,
        bruto,
        comparar_inicio,
        comparar_fim,
        filtro_tipo,
        filtro_nome,
    )


async def perguntar_periodo(tool_context: ToolContext) -> dict[str, Any]:
    """Pergunta a quem pediu de que período é o número, com os botões "Este mês", "Mês passado" e
    "Este ano". Use só numa pergunta de número de vendas sem período. Depois dela, não escreva nada:
    a pergunta já está na Conversa.

    Returns:
        A pergunta gravada e os rótulos dos botões.
    """
    client = CURRENT_CHAT_API.get()
    if client is None:
        return {"erro": FORA_DE_UM_PEDIDO}
    return await ask_period(client, tool_context)


async def gerar_relatorio(
    inicio: str,
    fim: str,
    tool_context: ToolContext,
    filtro_tipo: str | None = None,
    filtro_nome: str | None = None,
) -> dict[str, Any]:
    """Gera um Relatório de vendas em PDF de um período, com as seis Métricas do catálogo, o período
    anterior e as variações, e grava na Conversa o aviso de que começou; o PDF chega depois, na
    mesma Conversa. Use só quando o pedido pede relatório ou PDF. Depois dela, não escreva nada: o
    aviso (ou a recusa, ou a pergunta de qual nome) já está na Conversa.

    Args:
        inicio: O primeiro dia do período, em AAAA-MM-DD.
        fim: O último dia do período, em AAAA-MM-DD (inclusive).
        filtro_tipo: Só quando o pedido nomeia um cliente, vendedor ou produto: "cliente",
            "vendedor" ou "produto".
        filtro_nome: O nome como está no pedido (por exemplo, "Ana"), junto de `filtro_tipo`.

    Returns:
        A confirmação de que o aviso foi gravado, ou `erro` com o parâmetro a corrigir.
    """
    client = CURRENT_CHAT_API.get()
    store = CURRENT_BUSINESS.get()
    queue = CURRENT_REPORTS.get()
    if client is None or store is None or queue is None:
        return {"erro": FORA_DE_UM_PEDIDO}
    return await request_report(
        client, store, queue, tool_context, inicio, fim, filtro_tipo, filtro_nome
    )
