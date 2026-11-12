"""O Pedido que falha nunca deixa a Conversa sem nada (spec da F11, "Execução do Pedido", "Fim do
Pedido"; F11-T06, CA5 e CA6).

Com o app real, o modelo real e a API do chat falsa do conftest.py, que falha onde o teste pede.
"""

from __future__ import annotations

import logging

import httpx
import pytest
from google.adk.agents.run_config import RunConfig
from google.adk.sessions import InMemorySessionService, Session

from app.agent_requests.execution import NAO_CONSEGUI, ExecutionDeps, run_request
from app.agent_requests.models import AgentRequestBody
from app.chat_api import ChatApiClient
from tests.integration.conftest import BOT_TOKEN, FakeChatApi
from tests.integration.test_request_routes import (
    AUTH,
    is_reply,
    pedido,
    wait_for_end_log,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")


def replies(fake: FakeChatApi) -> list[str]:
    return [call["body"]["body"] for call in fake.requests if is_reply(call)]


async def test_a_leitura_que_falha_grava_o_nao_consegui(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    fake_chat_api.failures = {"/messages": [500]}
    body = pedido()

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "failed"
    assert replies(fake_chat_api) == [NAO_CONSEGUI]


async def test_o_teto_de_chamadas_grava_o_nao_consegui(
    fake_chat_api: FakeChatApi, caplog: pytest.LogCaptureFixture
) -> None:
    # Com uma chamada só, a da ferramenta, o texto final já passa do teto.
    caplog.set_level(logging.INFO, logger="app")
    body = pedido()
    chat_api = ChatApiClient(fake_chat_api.url, BOT_TOKEN)
    deps = ExecutionDeps(
        session_service=InMemorySessionService(),
        chat_api=chat_api,
        run_config=RunConfig(max_llm_calls=1),
    )
    try:
        await run_request(AgentRequestBody.model_validate(body), deps)
    finally:
        await chat_api.close()

    assert replies(fake_chat_api) == [NAO_CONSEGUI]
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "failed"
    assert any(
        record.levelno == logging.WARNING
        and getattr(record, "request_id", None) == body["request_id"]
        for record in caplog.records
    )


async def test_a_resposta_recusada_com_400_vira_o_nao_consegui(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    fake_chat_api.failures = {"/reply": [400]}
    body = pedido()

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "failed"
    [model_text, fallback] = replies(fake_chat_api)
    assert model_text != NAO_CONSEGUI
    assert fallback == NAO_CONSEGUI


@pytest.mark.parametrize("status", [409, 410])
async def test_a_resposta_recusada_pelo_pedido_nao_tenta_de_novo(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
    status: int,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    fake_chat_api.failures = {"/reply": [status]}
    body = pedido()

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "discarded"
    assert len(replies(fake_chat_api)) == 1


class BrokenSessions(InMemorySessionService):
    """O banco das sessões fora: a criação da sessão falha."""

    async def create_session(self, **kwargs: object) -> Session:
        raise ConnectionError("banco das sessões fora")


async def test_a_sessao_que_falha_grava_o_nao_consegui(
    fake_chat_api: FakeChatApi, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    body = pedido()
    chat_api = ChatApiClient(fake_chat_api.url, BOT_TOKEN)
    try:
        await run_request(
            AgentRequestBody.model_validate(body),
            ExecutionDeps(session_service=BrokenSessions(), chat_api=chat_api),
        )
    finally:
        await chat_api.close()

    assert replies(fake_chat_api) == [NAO_CONSEGUI]
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "failed"
