"""Cliente da API do chat, com a credencial de bot (spec da F11, "Execução do Pedido").

O Agente age na Conversa só pelas rotas /v1/bot, sob o identificador do Pedido (ADR 0010 e ADR
0011). As ferramentas e a gravação final usam este cliente.
"""

from __future__ import annotations

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

    async def reply(self, request_id: str, body: str) -> None:
        """Grava a resposta do bot ao Pedido; a repetição devolve a mesma Mensagem."""
        await self._post(f"/v1/bot/requests/{request_id}/reply", {"body": body})

    async def close(self) -> None:
        await self._http.aclose()

    async def _post(self, path: str, payload: dict) -> None:
        try:
            response = await self._http.post(path, json=payload)
        except httpx.HTTPError as error:
            raise ChatApiError(f"POST {path} falhou: {type(error).__name__}") from error
        if not response.is_success:
            raise ChatApiError(f"POST {path} respondeu {response.status_code}")
