"""Cliente da API do chat, com a credencial de bot (spec da F11, "Execução do Pedido").

O Agente age na Conversa só pelas rotas /v1/bot, sob o identificador do Pedido (ADR 0010 e ADR
0011). As ferramentas e a gravação final usam este cliente.
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Any

import httpx

TIMEOUT_S = 10.0


class ChatApiError(Exception):
    """A API do chat recusou a ação do bot ou não respondeu."""


class ChatApiClient:
    def __init__(self, base_url: str, token: str) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT_S,
        )

    async def read_messages(
        self,
        request_id: str,
        *,
        since: str | None,
        until: str | None,
        author_username: str | None,
    ) -> dict[str, Any]:
        """As Mensagens de Pessoas do Recorte, no máximo as do teto do resumo, e o `total`."""
        params = {
            key: value
            for key, value in {
                "since": since,
                "until": until,
                "author_username": author_username,
            }.items()
            if value is not None
        }
        response = await self._request(
            "GET", f"/v1/bot/requests/{request_id}/messages", params=params
        )
        return response.json()

    async def typing(self, request_id: str) -> None:
        """Avisa que o bot está digitando na Conversa do Pedido."""
        await self._request("POST", f"/v1/bot/requests/{request_id}/typing")

    async def reply(self, request_id: str, body: str) -> None:
        """Grava a resposta do bot ao Pedido; a repetição devolve a mesma Mensagem."""
        await self._request(
            "POST", f"/v1/bot/requests/{request_id}/reply", json={"body": body}
        )

    async def close(self) -> None:
        await self._http.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        """A chamada a uma rota /v1/bot; fora de 2xx, ou sem resposta, `ChatApiError`."""
        try:
            response = await self._http.request(method, path, **kwargs)
        except httpx.HTTPError as error:
            raise ChatApiError(
                f"{method} {path} falhou: {type(error).__name__}"
            ) from error
        if not response.is_success:
            raise ChatApiError(f"{method} {path} respondeu {response.status_code}")
        return response


# O cliente do Pedido em execução: o `run_request` o define antes de rodar o agente, e as
# ferramentas o leem. A tarefa do Pedido copia o contexto, e cada app tem o próprio cliente.
CURRENT_CHAT_API: ContextVar[ChatApiClient | None] = ContextVar(
    "CURRENT_CHAT_API", default=None
)
