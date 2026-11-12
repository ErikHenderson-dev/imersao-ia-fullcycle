"""O "digitando" do bot enquanto o Pedido roda (spec da F11, ""Digitando" do bot").

O aviso sai ao começar e de novo a cada intervalo; quem está na Conversa apaga o aviso depois da
"Expiração do digitando" sem renovação, e é isso que o encerra se o processo cair. A gravação da
resposta emite o fim na API do chat. Fica em volta da execução, e não dentro dela, para o
`run_request` não conhecer o aviso.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Coroutine
from typing import Any, Protocol

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
    """Roda `work` avisando que o bot digita: ao começar e a cada `interval` até o fim.

    Os avisos saem em horário fixo, cada um na própria tarefa: uma API do chat lenta não atrasa o
    trabalho nem o aviso seguinte.
    """
    pending: set[asyncio.Task[None]] = set()

    async def renew() -> None:
        while True:
            notice = asyncio.create_task(notify_typing(chat_api, request_id))
            pending.add(notice)
            notice.add_done_callback(pending.discard)
            await asyncio.sleep(interval)

    renewal = asyncio.create_task(renew())
    try:
        return await work
    finally:
        renewal.cancel()
        for notice in (renewal, *pending):
            notice.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await notice


async def notify_typing(chat_api: TypingClient, request_id: str) -> None:
    """Um aviso; a falha vai para o log e não interrompe o Pedido nem os avisos seguintes."""
    try:
        await chat_api.typing(request_id)
    except Exception as error:
        logger.warning("Aviso de digitando do Pedido %s falhou: %s", request_id, error)
