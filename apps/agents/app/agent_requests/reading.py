"""A leitura de um Recorte, que a ferramenta `ler_mensagens` faz (spec da F11, "O Agente
`assistente`").

O código converte o Recorte em UTC, lê as Mensagens de uma fonte e devolve ao modelo os números
prontos (`total`, `cobertas`) e o período em hora local: o modelo nunca calcula data nem contagem.
A fonte é a API do chat em produção e uma fixture na avaliação (`app/eval_fixtures.py`).
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any, Protocol

from app.agent_requests import context
from app.agent_requests.recorte import (
    DEFAULT_TIME_ZONE,
    RECORTES,
    recorte_interval,
    to_api_instant,
    zone,
)
from app.chat_api import ChatApiClient

LOCAL_FORMAT = "%d/%m, %H:%M"
# Como o Recorte aparece no cabeçalho do resumo ("Resumo de hoje").
LABELS = {
    "hoje": "de hoje",
    "desde_ontem": "desde ontem",
    "semana": "da semana",
    "tudo": "de tudo",
}


class MessageSource(Protocol):
    async def read(
        self,
        since: datetime | None,
        until: datetime,
        author_username: str | None,
    ) -> dict[str, Any]:
        """`{"messages": [{id, author: {name, username}, body, created_at}], "total": N}`, como a
        rota de leitura do bot."""
        ...


class ChatApiSource:
    """As Mensagens do Pedido pela rota /v1/bot da API do chat."""

    def __init__(self, client: ChatApiClient, request_id: str) -> None:
        self._client = client
        self._request_id = request_id

    async def read(
        self, since: datetime | None, until: datetime, author_username: str | None
    ) -> dict[str, Any]:
        return await self._client.read_messages(
            self._request_id,
            since=to_api_instant(since) if since else None,
            until=to_api_instant(until),
            author_username=author_username,
        )


def username_of(pessoa: str | None) -> str | None:
    """O @usuário sem o `@`, ou nenhum."""
    username = (pessoa or "").strip().lstrip("@").strip()
    return username or None


async def read_recorte(
    source: MessageSource,
    state: Mapping[str, Any],
    recorte: str,
    pessoa: str | None,
) -> dict[str, Any]:
    """O Recorte pedido, pronto para o modelo resumir."""
    if recorte not in RECORTES:
        return {"erro": f"Recorte desconhecido. Use um destes: {', '.join(RECORTES)}."}
    tz_name = state.get(context.TIME_ZONE) or DEFAULT_TIME_ZONE
    tz = zone(tz_name)
    requested_at = datetime.fromisoformat(state[context.REQUESTED_AT])
    interval = recorte_interval(recorte, tz_name, requested_at)
    username = username_of(pessoa)
    page = await source.read(interval.since, interval.until, username)
    until_local = interval.until.astimezone(tz).strftime(LOCAL_FORMAT)
    periodo = (
        f"{interval.since.astimezone(tz).strftime(LOCAL_FORMAT)} a {until_local}"
        if interval.since
        else f"até {until_local}"
    )
    mensagens = [
        {
            "autor": message["author"]["name"],
            "texto": message["body"],
            "quando": datetime.fromisoformat(message["created_at"])
            .astimezone(tz)
            .strftime(LOCAL_FORMAT),
        }
        for message in page["messages"]
    ]
    return {
        "recorte": recorte,
        "rotulo": LABELS[recorte],
        "periodo": periodo,
        "pessoa": username,
        "total": page["total"],
        "cobertas": len(mensagens),
        "mensagens": mensagens,
    }
