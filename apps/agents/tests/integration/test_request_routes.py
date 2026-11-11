"""Receber um Pedido e responder na Conversa: POST /v1/requests (F11-T03, CA4).

Com o app real, o modelo real e a API do chat falsa do conftest.py.
"""

from __future__ import annotations

import asyncio
import uuid

import httpx
import pytest

from tests.integration.conftest import BOT_TOKEN, FakeChatApi

AUTH = {"Authorization": "Bearer segredo-dos-testes"}

pytestmark = pytest.mark.asyncio(loop_scope="session")

# O modelo real responde em alguns segundos; a folga cobre a latência e as novas tentativas.
REPLY_TIMEOUT_S = 90


def pedido(agent: str = "assistente") -> dict:
    return {
        "request_id": str(uuid.uuid4()),
        "kind": "new",
        "parent_request_id": None,
        "agent": agent,
        "conversation_id": str(uuid.uuid4()),
        "message": {
            "id": str(uuid.uuid4()),
            "body": "@assistente responda só com a palavra olá",
        },
        "requester": {"id": str(uuid.uuid4()), "name": "Ana Souza", "username": "ana"},
        "mentions": [],
        "time_zone": "America/Sao_Paulo",
    }


async def wait_for_requests(fake: FakeChatApi, count: int) -> list[dict]:
    for _ in range(REPLY_TIMEOUT_S * 10):
        if len(fake.requests) >= count:
            return fake.requests
        await asyncio.sleep(0.1)
    raise AssertionError(f"A API do chat recebeu {len(fake.requests)} chamada(s)")


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
    [reply] = await wait_for_requests(fake_chat_api, 1)
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
