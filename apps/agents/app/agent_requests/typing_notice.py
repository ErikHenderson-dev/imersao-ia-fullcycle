"""O "digitando" do bot enquanto o Pedido roda (spec da F11, ""Digitando" do bot").

O aviso sai ao começar e de novo a cada intervalo; quem está na Conversa apaga o aviso depois da
"Expiração do digitando" sem renovação, e é isso que o encerra se o processo cair. A gravação da
resposta emite o fim na API do chat. Fica em volta da execução, e não dentro dela, para o
`run_request` não conhecer o aviso.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from typing import Any, Protocol

from app.chat_api import ChatApiError

logger = logging.getLogger(__name__)

# Intervalo do aviso de digitando (LLD, "Valores e configuração").
TYPING_INTERVAL_S = 3.0


class TypingClient(Protocol):
    async def typing(self, request_id: str) -> None: ...


async def while_typing[T](
    chat_api: TypingClient,
    request_id: str,
    work: Coroutine[Any, Any, T],
    interval: float = TYPING_INTERVAL_S,
) -> T:
    """Roda `work` avisando que o bot digita: antes de começar e a cada `interval` até o fim."""
    await notify_typing(chat_api, request_id)

    async def renew() -> None:
        while True:
            await asyncio.sleep(interval)
            await notify_typing(chat_api, request_id)

    renewal = asyncio.create_task(renew())
    try:
        return await work
    finally:
        renewal.cancel()


async def notify_typing(chat_api: TypingClient, request_id: str) -> None:
    """Um aviso; a recusa vai para o log e não interrompe o Pedido nem os avisos seguintes."""
    try:
        await chat_api.typing(request_id)
    except ChatApiError as error:
        logger.warning(
            "Aviso de digitando do Pedido %s recusado: %s", request_id, error
        )
