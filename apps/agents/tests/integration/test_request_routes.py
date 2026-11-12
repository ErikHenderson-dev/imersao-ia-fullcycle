"""Receber um Pedido e responder na Conversa: POST /v1/requests (F11-T03, CA4; o "digitando", F11-T05,
CA4; a conexão, o limite e o log do Pedido, F11-T06, CA2 e CA6).

Com o app real, o modelo real e a API do chat falsa do conftest.py.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from google.adk.sessions.in_memory_session_service import InMemorySessionService

from tests.integration.conftest import (
    BOT_TOKEN,
    SERVICE_TOKEN,
    FakeChatApi,
    app_client,
    set_assistant_connected,
    settings_for,
)

AUTH = {"Authorization": f"Bearer {SERVICE_TOKEN}"}

pytestmark = pytest.mark.asyncio(loop_scope="session")

# O modelo real responde em alguns segundos; a folga cobre a latência e as novas tentativas.
REPLY_TIMEOUT_S = 90


def uuid7_at(instant: datetime) -> uuid.UUID:
    """Um UUID v7 com o instante nos 48 bits do tempo, como o id da Mensagem do Pedido."""
    milliseconds = int(instant.timestamp() * 1000)
    random_bits = uuid.uuid4().int & ((1 << 62) - 1)
    return uuid.UUID(int=(milliseconds << 80) | (0x7 << 76) | (0x2 << 62) | random_bits)


def pedido(
    agent: str = "assistente",
    body: str = "@assistente resume hoje",
    time_zone: str = "America/Sao_Paulo",
    message_id: uuid.UUID | None = None,
) -> dict:
    return {
        "request_id": str(uuid.uuid4()),
        "kind": "new",
        "parent_request_id": None,
        "agent": agent,
        "conversation_id": str(uuid.uuid4()),
        "message": {
            "id": str(message_id or uuid.uuid4()),
            "body": body,
        },
        "requester": {"id": str(uuid.uuid4()), "name": "Ana Souza", "username": "ana"},
        "mentions": [],
        "time_zone": time_zone,
    }


def is_reply(call: dict) -> bool:
    return call["method"] == "POST" and call["path"].endswith("/reply")


async def wait_for_reply(fake: FakeChatApi) -> list[dict]:
    """As chamadas à API falsa até a `reply`, que fecha o Pedido."""
    for _ in range(REPLY_TIMEOUT_S * 10):
        if any(is_reply(request) for request in fake.requests):
            return fake.requests
        await asyncio.sleep(0.1)
    raise AssertionError(f"A API do chat recebeu {fake.requests}")


async def wait_for_end_log(
    caplog: pytest.LogCaptureFixture, request_id: str
) -> logging.LogRecord:
    """O registro do fim do Pedido (F11-T06, CA6), que sai logo depois da gravação."""
    for _ in range(REPLY_TIMEOUT_S * 10):
        ends = [
            record
            for record in caplog.records
            if getattr(record, "request_id", None) == request_id
            and hasattr(record, "desfecho")
        ]
        if ends:
            [end] = ends
            return end
        await asyncio.sleep(0.1)
    raise AssertionError("O Pedido terminou sem o registro do fim")


async def test_responde_401_sem_a_credencial(request_client: httpx.AsyncClient) -> None:
    response = await request_client.post("/v1/requests", json=pedido())

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_responde_404_fora_do_catalogo(
    request_client: httpx.AsyncClient, fake_chat_api: FakeChatApi
) -> None:
    response = await request_client.post(
        "/v1/requests", json=pedido("agente-que-nao-existe"), headers=AUTH
    )

    assert response.status_code == 404
    assert response.json()["code"] == "agent_not_found"
    assert fake_chat_api.requests == []


async def test_aceita_o_pedido_e_grava_a_resposta_como_reply(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    body = pedido()

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    calls = await wait_for_reply(fake_chat_api)
    typing = next(call for call in calls if call["path"].endswith("/typing"))
    assert calls.index(typing) < next(
        i for i, call in enumerate(calls) if is_reply(call)
    )
    assert typing["method"] == "POST"
    assert typing["path"] == f"/v1/bot/requests/{body['request_id']}/typing"
    assert typing["authorization"] == f"Bearer {BOT_TOKEN}"
    [reply] = [call for call in calls if is_reply(call)]
    assert reply["path"] == f"/v1/bot/requests/{body['request_id']}/reply"
    assert reply["authorization"] == f"Bearer {BOT_TOKEN}"
    assert reply["body"]["body"].strip()
    transport = request_client._transport
    assert isinstance(transport, httpx.ASGITransport)
    session = await transport.app.state.session_service.get_session(
        app_name="assistente",
        user_id=body["requester"]["id"],
        session_id=body["request_id"],
    )
    assert session is not None
    assert session.state["request_id"] == body["request_id"]
    assert session.state["conversation_id"] == body["conversation_id"]
    assert session.state["requester_id"] == body["requester"]["id"]
    assert session.state["time_zone"] == "America/Sao_Paulo"
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.levelno == logging.INFO
    assert end.desfecho == "reply"
    assert end.tempo_ms > 0
    assert end.tokens_entrada > 0
    assert end.tokens_saida > 0
    logged = "\n".join(record.getMessage() for record in caplog.records)
    assert body["message"]["body"] not in logged
    assert reply["body"]["body"] not in logged


async def test_um_pedido_com_recorte_le_o_recorte_certo_e_grava_o_resumo(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
) -> None:
    # 03:30 de 11/11 em Tóquio (UTC+9): o "hoje" começa às 15:00 UTC de 10/11.
    asked_at = datetime(2026, 11, 10, 18, 30, tzinfo=UTC)
    fake_chat_api.conversation = [
        {
            "id": str(uuid7_at(datetime(2026, 11, 10, 16, 0, tzinfo=UTC))),
            "author": {"name": "Bruno Lima", "username": "bruno"},
            "body": "Subi o deploy da versão 2.3 em staging.",
            "created_at": "2026-11-10T16:00:00.000Z",
        },
        {
            "id": str(uuid7_at(datetime(2026, 11, 10, 17, 0, tzinfo=UTC))),
            "author": {"name": "Carla Dias", "username": "carla"},
            "body": "Testei o login em staging e está tudo certo.",
            "created_at": "2026-11-10T17:00:00.000Z",
        },
    ]
    body = pedido(
        body="@assistente o que rolou hoje?",
        time_zone="Asia/Tokyo",
        message_id=uuid7_at(asked_at),
    )

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    calls = await wait_for_reply(fake_chat_api)
    [read] = [call for call in calls if call["method"] == "GET"]
    assert read["path"] == f"/v1/bot/requests/{body['request_id']}/messages"
    assert read["authorization"] == f"Bearer {BOT_TOKEN}"
    assert read["query"] == {
        "since": "2026-11-10T15:00:00.000Z",
        "until": "2026-11-10T18:30:00.000Z",
    }
    [reply] = [call for call in calls if is_reply(call)]
    assert reply["path"] == f"/v1/bot/requests/{body['request_id']}/reply"
    assert reply["body"]["body"].strip()
    assert "@" not in reply["body"]["body"]


async def test_responde_409_com_o_agente_desconectado(
    request_client: httpx.AsyncClient, fake_chat_api: FakeChatApi
) -> None:
    await set_assistant_connected(request_client, False)

    response = await request_client.post("/v1/requests", json=pedido(), headers=AUTH)

    assert response.status_code == 409
    assert response.json()["code"] == "agent_not_connected"
    assert fake_chat_api.requests == []


async def test_responde_429_acima_do_limite_de_pedidos_da_pessoa_no_minuto(
    test_database_url: str,
    fake_chat_api: FakeChatApi,
    caplog: pytest.LogCaptureFixture,
) -> None:
    # Com o limite em 1, o segundo Pedido da mesma Pessoa no minuto é o que passa do limite; o
    # padrão de 10 é o da configuração (tests/unit/test_config.py).
    settings = settings_for(
        test_database_url, adk_dev_routes=False, chat_api_url=fake_chat_api.url
    )
    settings.agent_requests_per_minute = 1
    caplog.set_level(logging.INFO, logger="app")
    async with app_client(settings) as client:
        await set_assistant_connected(client, True)
        first = pedido()
        second = {**pedido(), "requester": first["requester"]}
        # O segundo logo depois do primeiro, na mesma janela de um minuto.
        accepted = await client.post("/v1/requests", json=first, headers=AUTH)

        response = await client.post("/v1/requests", json=second, headers=AUTH)

        await wait_for_reply(fake_chat_api)
        assert accepted.status_code == 202
        assert response.status_code == 429
        assert response.json()["code"] == "rate_limited"
        [warning] = [
            record
            for record in caplog.records
            if getattr(record, "request_id", None) == second["request_id"]
        ]
        assert warning.levelno == logging.WARNING
        assert second["message"]["body"] not in warning.getMessage()
        assert not any(
            call["path"].startswith(f"/v1/bot/requests/{second['request_id']}")
            for call in fake_chat_api.requests
        )


async def test_responde_503_com_o_redis_fora(
    test_database_url: str, fake_chat_api: FakeChatApi
) -> None:
    # Ninguém escuta nesta porta: o Redis do limite está fora.
    settings = settings_for(
        test_database_url,
        adk_dev_routes=False,
        chat_api_url=fake_chat_api.url,
        redis_url="redis://127.0.0.1:9/0",
    )
    async with app_client(settings) as client:
        await set_assistant_connected(client, True)

        response = await client.post("/v1/requests", json=pedido(), headers=AUTH)

        assert response.status_code == 503
        assert response.json()["code"] == "agents_unavailable"
        assert fake_chat_api.requests == []


async def test_reentregar_o_mesmo_pedido_responde_202_sem_rodar_de_novo(
    test_database_url: str,
    fake_chat_api: FakeChatApi,
    caplog: pytest.LogCaptureFixture,
) -> None:
    # O reenvio do mesmo client_id dispara o mesmo Pedido de novo: ele é aceito sem gastar o
    # limite (aqui, 1), e só a primeira entrega responde.
    settings = settings_for(
        test_database_url, adk_dev_routes=False, chat_api_url=fake_chat_api.url
    )
    settings.agent_requests_per_minute = 1
    caplog.set_level(logging.INFO, logger="app")
    async with app_client(settings) as client:
        await set_assistant_connected(client, True)
        body = pedido()
        await client.post("/v1/requests", json=body, headers=AUTH)
        await wait_for_end_log(caplog, body["request_id"])
        calls_before = len(fake_chat_api.requests)

        response = await client.post("/v1/requests", json=body, headers=AUTH)

        assert response.status_code == 202
        await asyncio.sleep(1)
        assert len(fake_chat_api.requests) == calls_before


async def test_entregas_simultaneas_do_mesmo_pedido_gastam_o_limite_uma_vez(
    test_database_url: str,
    fake_chat_api: FakeChatApi,
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # As duas entregas chegam antes de a sessão do Pedido existir: só uma passa ao limite (aqui, 2),
    # e o Pedido seguinte da mesma Pessoa ainda cabe nele. A leitura da sessão demora de propósito,
    # para as duas entregas a consultarem antes de a primeira criá-la.
    get_session = InMemorySessionService.get_session

    async def slow_get_session(self: InMemorySessionService, **kwargs: Any) -> Any:
        await asyncio.sleep(0.3)
        return await get_session(self, **kwargs)

    monkeypatch.setattr(InMemorySessionService, "get_session", slow_get_session)
    settings = settings_for(
        test_database_url, adk_dev_routes=False, chat_api_url=fake_chat_api.url
    )
    settings.agent_requests_per_minute = 2
    caplog.set_level(logging.INFO, logger="app")
    async with app_client(settings) as client:
        await set_assistant_connected(client, True)
        body = pedido()
        following = {**pedido(), "requester": body["requester"]}

        deliveries = await asyncio.gather(
            client.post("/v1/requests", json=body, headers=AUTH),
            client.post("/v1/requests", json=body, headers=AUTH),
        )
        response = await client.post("/v1/requests", json=following, headers=AUTH)

        assert [delivery.status_code for delivery in deliveries] == [202, 202]
        assert response.status_code == 202
        await wait_for_end_log(caplog, body["request_id"])
        await wait_for_end_log(caplog, following["request_id"])
