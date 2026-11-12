"""Cliente da API do chat, com a credencial de bot (spec da F11, "Execução do Pedido"), ou com a do
Worker, só na entrega e na falha do Relatório (spec da F14, "Worker de agentes").

O Agente age na Conversa só pelas rotas /v1/bot, sob o identificador do Pedido (ADR 0010 e ADR
0011). As ferramentas e a gravação final usam este cliente.
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Any

import httpx

TIMEOUT_S = 10.0

# Os status em que a API do chat diz que o Pedido acabou (inexistente, encerrado ou vencido): quem
# age nele para, sem nova tentativa.
REQUEST_GONE = frozenset({404, 409, 410})


class ChatApiError(Exception):
    """A API do chat recusou a ação do bot ou não respondeu; `status` é nulo sem resposta."""

    def __init__(
        self, message: str, status: int | None = None, code: str | None = None
    ) -> None:
        super().__init__(message)
        self.status = status
        # O `code` do corpo problem+json, quando a API do chat o mandou (F12-T01).
        self.code = code


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

    async def message_counts(
        self, request_id: str, *, sinces: list[str], until: str
    ) -> dict[str, Any]:
        """As contagens que a leitura traria desde cada `since` até `until`, e o `total` sem
        início (F11-T07)."""
        params = [("since", since) for since in sinces] + [("until", until)]
        response = await self._request(
            "GET", f"/v1/bot/requests/{request_id}/message-counts", params=params
        )
        return response.json()

    async def question(
        self,
        request_id: str,
        body: str,
        quick_replies: list[str],
        *,
        business_data: bool = False,
    ) -> None:
        """Grava a pergunta do bot com as Respostas prontas; a repetição devolve a mesma
        Mensagem (F11-T07)."""
        await self._request(
            "POST",
            f"/v1/bot/requests/{request_id}/question",
            json={
                "body": body,
                "quick_replies": quick_replies,
                "business_data": business_data,
            },
        )

    async def task(self, request_id: str, assignee_username: str, title: str) -> None:
        """Delega a Tarefa e grava a confirmação do bot; a repetição devolve as mesmas (spec da
        F12, "Ação `task`")."""
        await self._request(
            "POST",
            f"/v1/bot/requests/{request_id}/task",
            json={"assignee_username": assignee_username, "title": title},
        )

    async def typing(self, request_id: str) -> None:
        """Avisa que o bot está digitando na Conversa do Pedido."""
        await self._request("POST", f"/v1/bot/requests/{request_id}/typing")

    async def reply(
        self, request_id: str, body: str, *, business_data: bool = False
    ) -> None:
        """Grava a resposta do bot ao Pedido; a repetição devolve a mesma Mensagem. Com
        `business_data`, a resposta leva a marca "dados de negócio" (spec da F13)."""
        await self._request(
            "POST",
            f"/v1/bot/requests/{request_id}/reply",
            json={"body": body, "business_data": business_data},
        )

    async def report_started(self, request_id: str, body: str) -> None:
        """Grava o Aviso de início do Relatório, com a marca, e estende a validade do Pedido (spec da
        F14, "Ações de bot do Relatório")."""
        await self._request(
            "POST", f"/v1/bot/requests/{request_id}/report-started", json={"body": body}
        )

    async def report_delivered(
        self, request_id: str, *, storage_key: str, file_name: str, size_bytes: int
    ) -> None:
        """Entrega o PDF já gravado no armazenamento; só com a credencial do Worker."""
        await self._request(
            "POST",
            f"/v1/bot/requests/{request_id}/report-delivered",
            json={
                "storage_key": storage_key,
                "file_name": file_name,
                "size_bytes": size_bytes,
            },
        )

    async def report_failed(self, request_id: str) -> None:
        """Grava o "não consegui gerar o relatório", com a Menção a quem pediu."""
        await self._request("POST", f"/v1/bot/requests/{request_id}/report-failed")

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
            raise ChatApiError(
                f"{method} {path} respondeu {response.status_code}",
                response.status_code,
                _problem_code(response),
            )
        return response


def _problem_code(response: httpx.Response) -> str | None:
    """O `code` do corpo problem+json da recusa, ou nulo se o corpo não o tem."""
    try:
        body = response.json()
    except ValueError:
        return None
    code = body.get("code") if isinstance(body, dict) else None
    return code if isinstance(code, str) else None


# O cliente do Pedido em execução: o `run_request` o define antes de rodar o agente, e as
# ferramentas o leem. A tarefa do Pedido copia o contexto, e cada app tem o próprio cliente.
CURRENT_CHAT_API: ContextVar[ChatApiClient | None] = ContextVar(
    "CURRENT_CHAT_API", default=None
)
