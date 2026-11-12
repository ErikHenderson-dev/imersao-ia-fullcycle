"""A delegação de Tarefa pelo `assistente` (spec da F12, "O Agente `assistente`" e "Rota de Pedido
e execução"; F12-T01, CA5 e CA6).

Com o app real, o modelo real e a API do chat falsa do conftest.py.
"""

from __future__ import annotations

import logging
import uuid

import httpx
import pytest

from tests.integration.conftest import FakeChatApi
from tests.integration.test_request_routes import (
    AUTH,
    is_reply,
    pedido,
    wait_for_end_log,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")

BRUNO = {"username": "bruno", "name": "Bruno Lima"}


def is_task(call: dict) -> bool:
    return call["method"] == "POST" and call["path"].endswith("/task")


async def run(
    client: httpx.AsyncClient,
    caplog: pytest.LogCaptureFixture,
    text: str,
    mentions: list[dict] | None = None,
) -> tuple[dict, logging.LogRecord]:
    """Manda o Pedido e espera o registro do fim."""
    caplog.set_level(logging.INFO, logger="app")
    body = {**pedido(body=text), "mentions": mentions or []}
    response = await client.post("/v1/requests", json=body, headers=AUTH)
    assert response.status_code == 202
    return body, await wait_for_end_log(caplog, body["request_id"])


async def test_delega_ao_mencionado_sem_gravar_reply(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    body, end = await run(
        request_client,
        caplog,
        "@assistente delega pra @bruno revisar o contrato até sexta",
        [BRUNO],
    )

    assert end.desfecho == "task"
    [task] = [call for call in fake_chat_api.requests if is_task(call)]
    assert task["path"] == f"/v1/bot/requests/{body['request_id']}/task"
    assert task["body"]["assignee_username"] == "bruno"
    title = task["body"]["title"]
    assert 0 < len(title) <= 120
    assert "@" not in title
    assert "contrato" in title.lower()
    assert not any(is_reply(call) for call in fake_chat_api.requests)


async def test_me_vira_quem_pediu(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    _, end = await run(
        request_client, caplog, "@assistente me lembra de revisar o contrato"
    )

    assert end.desfecho == "task"
    [task] = [call for call in fake_chat_api.requests if is_task(call)]
    assert task["body"]["assignee_username"] == "ana"
    assert "contrato" in task["body"]["title"].lower()


async def test_responsavel_recusado_vira_recusa(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    fake_chat_api.failures["/task"] = [(422, "assignee_not_member")]

    _, end = await run(
        request_client,
        caplog,
        "@assistente delega pra @bruno revisar o contrato",
        [BRUNO],
    )

    assert end.desfecho == "reply"
    [reply] = [call for call in fake_chat_api.requests if is_reply(call)]
    assert reply["body"]["body"].strip()


# F12-T04, CA5: a delegação sem Responsável pergunta, e a continuação cria a Tarefa.
async def test_sem_responsavel_pergunta_e_a_continuacao_cria_a_tarefa(
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    asked, end = await run(
        request_client, caplog, "@assistente delega a revisão do contrato"
    )
    assert end.desfecho == "question"
    [question] = [
        call for call in fake_chat_api.requests if call["path"].endswith("/question")
    ]
    assert question["body"]["body"] == "A quem eu delego?"
    answer = {
        **asked,
        "request_id": str(uuid.uuid4()),
        "kind": "continuation",
        "parent_request_id": asked["request_id"],
        "message": {"id": str(uuid.uuid4()), "body": "@ana"},
        "mentions": [{"username": "ana", "name": "Ana Souza"}],
    }

    response = await request_client.post("/v1/requests", json=answer, headers=AUTH)

    assert response.status_code == 202
    finished = await wait_for_end_log(caplog, answer["request_id"])
    assert finished.desfecho == "task"
    [task] = [call for call in fake_chat_api.requests if is_task(call)]
    assert task["path"] == f"/v1/bot/requests/{answer['request_id']}/task"
    assert task["body"]["assignee_username"] == "ana"
    assert "contrato" in task["body"]["title"].lower()
