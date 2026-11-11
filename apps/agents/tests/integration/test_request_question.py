"""A pergunta pelo Recorte e a continuação na mesma sessão (spec da F11, "Execução do Pedido" e "O
Agente `assistente`"; F11-T07, CA5 e CA7).

Com o app real, o modelo real e a API do chat falsa do conftest.py.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

import httpx
import pytest

from app.agents.assistente.instructions import NAO_ENTENDI
from tests.integration.conftest import FakeChatApi
from tests.integration.test_request_routes import (
    AUTH,
    is_reply,
    pedido,
    uuid7_at,
    wait_for_end_log,
    wait_for_reply,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")

# 10/11/2026, 15:00 em São Paulo (UTC-3); a continuação, um minuto depois.
ASKED_AT = datetime(2026, 11, 10, 18, 0, tzinfo=UTC)
ANSWERED_AT = datetime(2026, 11, 10, 18, 1, tzinfo=UTC)

TODAY = [
    {
        "id": str(uuid7_at(datetime(2026, 11, 10, 13, 0, tzinfo=UTC))),
        "author": {"name": "Bruno Lima", "username": "bruno"},
        "body": "Subi o deploy da versão 2.3 em staging.",
        "created_at": "2026-11-10T13:00:00.000Z",
    },
    {
        "id": str(uuid7_at(datetime(2026, 11, 10, 14, 0, tzinfo=UTC))),
        "author": {"name": "Carla Dias", "username": "carla"},
        "body": "Testei o login em staging e está tudo certo.",
        "created_at": "2026-11-10T14:00:00.000Z",
    },
]


def is_question(call: dict) -> bool:
    return call["method"] == "POST" and call["path"].endswith("/question")


async def ask(client: httpx.AsyncClient, fake: FakeChatApi, caplog) -> dict:
    """Um Pedido sem Recorte, que termina com a pergunta gravada."""
    body = pedido(
        body="@assistente resume a conversa pra mim", message_id=uuid7_at(ASKED_AT)
    )
    response = await client.post("/v1/requests", json=body, headers=AUTH)
    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "question"
    return body


def continuation(parent: dict, text: str) -> dict:
    """A resposta de quem pediu, sem Menção: a continuação do Pedido que perguntou."""
    return {
        **parent,
        "request_id": str(uuid.uuid4()),
        "kind": "continuation",
        "parent_request_id": parent["request_id"],
        "message": {"id": str(uuid7_at(ANSWERED_AT)), "body": text},
    }


async def test_um_pedido_sem_recorte_grava_a_pergunta_com_as_contagens(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")

    body = await ask(request_client, fake_chat_api, caplog)

    calls = fake_chat_api.requests
    [counts] = [call for call in calls if call["path"].endswith("/message-counts")]
    assert counts["path"] == f"/v1/bot/requests/{body['request_id']}/message-counts"
    assert counts["query_all"] == {
        "since": [
            "2026-11-10T03:00:00.000Z",
            "2026-11-09T03:00:00.000Z",
            "2026-11-03T18:00:00.000Z",
        ],
        "until": ["2026-11-10T18:00:00.000Z"],
    }
    [question] = [call for call in calls if is_question(call)]
    assert question["path"] == f"/v1/bot/requests/{body['request_id']}/question"
    assert question["body"]["quick_replies"] == [
        "Hoje (4)",
        "Desde ontem (6)",
        "A semana (9)",
        "Tudo (15)",
    ]
    assert question["body"]["body"].strip()
    assert not any(is_reply(call) for call in calls)


async def test_a_continuacao_retoma_a_sessao_e_grava_o_resumo(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    fake_chat_api.conversation = TODAY
    parent = await ask(request_client, fake_chat_api, caplog)
    body = continuation(parent, "Hoje (4)")

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    calls = await wait_for_reply(fake_chat_api)
    [read] = [call for call in calls if call["path"].endswith("/messages")]
    assert read["path"] == f"/v1/bot/requests/{body['request_id']}/messages"
    assert read["query"] == {
        "since": "2026-11-10T03:00:00.000Z",
        "until": "2026-11-10T18:01:00.000Z",
    }
    [reply] = [call for call in calls if is_reply(call)]
    assert reply["path"] == f"/v1/bot/requests/{body['request_id']}/reply"
    assert reply["body"]["body"].strip()
    transport = request_client._transport
    assert isinstance(transport, httpx.ASGITransport)
    session = await transport.app.state.session_service.get_session(
        app_name="assistente",
        user_id=parent["requester"]["id"],
        session_id=parent["request_id"],
    )
    texts = [
        part.text
        for event in session.events
        if event.author == "user" and event.content
        for part in event.content.parts or []
        if part.text
    ]
    assert texts == [parent["message"]["body"], "Hoje (4)"]
    assert session.state["request_id"] == body["request_id"]


async def test_a_continuacao_que_nao_responde_diz_que_nao_entendeu(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    parent = await ask(request_client, fake_chat_api, caplog)
    before = len(fake_chat_api.requests)
    body = continuation(parent, "@ana você viu o deploy?")

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    calls = (await wait_for_reply(fake_chat_api))[before:]
    [reply] = [call for call in calls if is_reply(call)]
    assert reply["body"]["body"].strip() == NAO_ENTENDI
    assert not any(call["method"] == "GET" or is_question(call) for call in calls)


async def test_a_continuacao_entregue_de_novo_nao_roda_outra_vez(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    fake_chat_api.conversation = TODAY
    parent = await ask(request_client, fake_chat_api, caplog)
    body = continuation(parent, "Hoje (4)")
    await request_client.post("/v1/requests", json=body, headers=AUTH)
    await wait_for_end_log(caplog, body["request_id"])

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    await wait_for_end_log(caplog, body["request_id"])
    assert len([call for call in fake_chat_api.requests if is_reply(call)]) == 1
