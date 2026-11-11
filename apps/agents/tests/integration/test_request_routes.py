"""Receber um Pedido e responder na Conversa: POST /v1/requests (F11-T03, CA4; o "digitando", F11-T05, CA4).

Com o app real, o modelo real e a API do chat falsa do conftest.py.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime

import httpx
import pytest

from tests.integration.conftest import BOT_TOKEN, SERVICE_TOKEN, FakeChatApi

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
    request_client: httpx.AsyncClient, fake_chat_api: FakeChatApi
) -> None:
    body = pedido()

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    calls = await wait_for_reply(fake_chat_api)
    typing, *_ = calls
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


async def test_um_pedido_com_recorte_le_o_recorte_certo_e_grava_o_resumo(
    request_client: httpx.AsyncClient, fake_chat_api: FakeChatApi
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
