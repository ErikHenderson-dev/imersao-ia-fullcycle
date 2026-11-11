"""O "digitando" do bot enquanto o Pedido roda (F11-T05, CA4)."""

from __future__ import annotations

import asyncio

import pytest

from app.agent_requests.typing_notice import while_typing
from app.chat_api import ChatApiError

pytestmark = pytest.mark.asyncio

REQUEST_ID = "0193a1b2-0000-7000-8000-000000000001"
INTERVAL_S = 0.05


class FakeChatApi:
    """Guarda o instante de cada aviso; `failures` avisos recusados no começo e `delay` de cada um."""

    def __init__(self, failures: int = 0, delay: float = 0.0) -> None:
        self.calls: list[tuple[str, float]] = []
        self.failures = failures
        self.delay = delay

    async def typing(self, request_id: str) -> None:
        self.calls.append((request_id, asyncio.get_running_loop().time()))
        await asyncio.sleep(self.delay)
        if self.failures:
            self.failures -= 1
            raise ChatApiError("POST typing respondeu 503")


async def work(seconds: float, started: list[float] | None = None) -> str:
    if started is not None:
        started.append(asyncio.get_running_loop().time())
    await asyncio.sleep(seconds)
    return "feito"


async def test_avisa_ao_comecar_e_a_cada_intervalo() -> None:
    chat_api = FakeChatApi()
    started: list[float] = []

    result = await while_typing(
        chat_api, REQUEST_ID, work(INTERVAL_S * 3.5, started), INTERVAL_S
    )

    assert result == "feito"
    assert [request_id for request_id, _ in chat_api.calls] == [REQUEST_ID] * 4
    first_notice = chat_api.calls[0][1]
    assert abs(first_notice - started[0]) < INTERVAL_S / 2


async def test_uma_api_lenta_nao_atrasa_o_aviso_seguinte() -> None:
    chat_api = FakeChatApi(delay=INTERVAL_S * 2)

    await while_typing(chat_api, REQUEST_ID, work(INTERVAL_S * 3.5), INTERVAL_S)

    assert len(chat_api.calls) == 4


async def test_para_quando_o_trabalho_termina() -> None:
    chat_api = FakeChatApi()
    await while_typing(chat_api, REQUEST_ID, work(INTERVAL_S * 1.5), INTERVAL_S)
    count = len(chat_api.calls)

    await asyncio.sleep(INTERVAL_S * 3)

    assert len(chat_api.calls) == count


async def test_para_quando_o_trabalho_falha() -> None:
    chat_api = FakeChatApi()

    async def failing() -> None:
        await asyncio.sleep(INTERVAL_S * 1.5)
        raise RuntimeError("modelo fora")

    with pytest.raises(RuntimeError):
        await while_typing(chat_api, REQUEST_ID, failing(), INTERVAL_S)
    count = len(chat_api.calls)
    await asyncio.sleep(INTERVAL_S * 3)

    assert len(chat_api.calls) == count


async def test_um_aviso_que_falha_nao_interrompe() -> None:
    chat_api = FakeChatApi(failures=1)

    result = await while_typing(
        chat_api, REQUEST_ID, work(INTERVAL_S * 2.5), INTERVAL_S
    )

    assert result == "feito"
    assert len(chat_api.calls) == 3
