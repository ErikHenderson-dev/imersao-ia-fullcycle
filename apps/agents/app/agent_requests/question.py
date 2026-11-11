"""A pergunta pelo Recorte, que a ferramenta `perguntar_recorte` faz (spec da F11, "O Agente
`assistente`").

O código calcula os Recortes pelo fuso e pelo instante do Pedido, pede as contagens de uma vez e
monta os rótulos das Respostas prontas com elas: o modelo não calcula data, contagem nem botão. As
contagens vêm da API do chat em produção e da fixture na avaliação (`app/eval_fixtures.py`).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from google.adk.tools import ToolContext

from app.agent_requests import context
from app.agent_requests.reading import request_clock
from app.agent_requests.recorte import recorte_interval

# O texto da pergunta, como no Figma (Conversa / Mensagem / Pergunta do agente).
QUESTION_BODY = (
    "De que período você quer o resumo? Você pode responder sem me mencionar."
)
# O rótulo de cada Recorte com início, na ordem dos botões; "Tudo" é o total, sem início. O
# modelo reconhece a resposta pelo começo do rótulo.
COUNTED_RECORTES = (
    ("hoje", "Hoje"),
    ("desde_ontem", "Desde ontem"),
    ("semana", "A semana"),
)
ALL_LABEL = "Tudo"


@dataclass(frozen=True)
class CountWindow:
    # O início de cada Recorte com início, na ordem de COUNTED_RECORTES.
    sinces: list[datetime]
    # O instante do Pedido, exclusivo, como na leitura.
    until: datetime


class MessageCounter(Protocol):
    async def count(self, sinces: list[datetime], until: datetime) -> dict[str, Any]:
        """`{"counts": [{since, count}], "total": N}`, como a rota de contagens do bot."""
        ...


def count_window(state: Mapping[str, Any]) -> CountWindow:
    """Os inícios dos Recortes e o fim, pelo fuso e pelo instante do Pedido no estado."""
    time_zone, requested_at = request_clock(state)
    intervals = [
        recorte_interval(recorte, time_zone, requested_at)
        for recorte, _ in COUNTED_RECORTES
    ]
    return CountWindow(
        sinces=[interval.since for interval in intervals if interval.since],
        until=intervals[0].until,
    )


def quick_reply_labels(counts: list[int], total: int) -> list[str]:
    """ "Hoje (N)", "Desde ontem (N)", "A semana (N)" e "Tudo (N)", com as contagens na ordem."""
    labels = [
        f"{label} ({count})"
        for (_, label), count in zip(COUNTED_RECORTES, counts, strict=True)
    ]
    return [*labels, f"{ALL_LABEL} ({total})"]


async def recorte_options(
    counter: MessageCounter, state: Mapping[str, Any]
) -> list[str]:
    """Os rótulos das Respostas prontas, com as contagens de agora."""
    window = count_window(state)
    result = await counter.count(window.sinces, window.until)
    return quick_reply_labels(
        [item["count"] for item in result["counts"]], result["total"]
    )


def question_asked(tool_context: ToolContext, options: list[str]) -> dict[str, Any]:
    """Marca que este Pedido perguntou, e não responde com texto: o evento da ferramenta vira a
    resposta final, sem nova chamada ao modelo (`skip_summarization`)."""
    tool_context.state[context.QUESTION_FOR] = tool_context.state[context.REQUEST_ID]
    tool_context.actions.skip_summarization = True
    return {"pergunta": QUESTION_BODY, "opcoes": options}
