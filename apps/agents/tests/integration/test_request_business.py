"""A consulta a Dados de negócio pelo `assistente`, com o modelo real (spec da F13, "O Agente
`assistente`"; F13-T04, CA8).

Com o app real, o `business_test` carregado e a API do chat falsa do conftest.py. O faturamento
esperado sai de SQL escrito à mão.
"""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.business.answer import format_money
from tests.integration.conftest import FakeChatApi
from tests.integration.test_request_routes import (
    AUTH,
    is_reply,
    pedido,
    wait_for_end_log,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_a_pergunta_de_faturamento_grava_a_resposta_com_a_marca(
    loaded_business_test: str,
    test_database_url: str,
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    business = create_async_engine(loaded_business_test)
    async with business.connect() as connection:
        expected = (
            await connection.execute(
                text(
                    "SELECT sum(net_amount) FROM orders WHERE status = 'paid' "
                    "AND ordered_at >= '2026-03-01 00:00-03' AND ordered_at < '2026-04-01 00:00-03'"
                )
            )
        ).scalar_one()
    await business.dispose()
    caplog.set_level(logging.INFO, logger="app")
    body = pedido(body="@assistente quanto faturamos em março de 2026?")
    body["requester"]["data_access"] = True

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "business"
    [reply] = [call for call in fake_chat_api.requests if is_reply(call)]
    assert reply["body"]["business_data"] is True
    assert format_money(Decimal(expected)) in reply["body"]["body"]
    assert "Considerado: faturamento líquido, pedidos pagos" in reply["body"]["body"]
    agents = create_async_engine(test_database_url)
    async with agents.connect() as connection:
        outcome = (
            await connection.execute(
                text("SELECT outcome FROM business_queries WHERE request_id = :id"),
                {"id": uuid.UUID(body["request_id"])},
            )
        ).scalar_one()
    await agents.dispose()
    assert outcome == "answered"


def is_question(call: dict) -> bool:
    return call["method"] == "POST" and call["path"].endswith("/question")


async def test_a_continuacao_com_o_nome_completo_responde_a_consulta_filtrada(
    loaded_business_test: str,
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    parent = pedido(body="@assistente quantos pedidos a Ana fechou em junho de 2026?")
    parent["requester"]["data_access"] = True
    await request_client.post("/v1/requests", json=parent, headers=AUTH)
    await wait_for_end_log(caplog, parent["request_id"])
    body = {
        **parent,
        "request_id": str(uuid.uuid4()),
        "kind": "continuation",
        "parent_request_id": parent["request_id"],
        "message": {"id": str(uuid.uuid4()), "body": "Ana Paula Ramos"},
    }

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "business"
    [question] = [call for call in fake_chat_api.requests if is_question(call)]
    assert question["body"]["quick_replies"] == ["Ana Beatriz Costa", "Ana Paula Ramos"]
    [reply] = [call for call in fake_chat_api.requests if is_reply(call)]
    assert reply["body"]["body"].startswith(
        "Pedidos pagos (vendedor Ana Paula Ramos) em junho de 2026:"
    )


# A pergunta de período (F13-T06, CA4), com o modelo real.


async def ask_period(
    client: httpx.AsyncClient, caplog: pytest.LogCaptureFixture
) -> dict:
    caplog.set_level(logging.INFO, logger="app")
    parent = pedido(body="@assistente quanto faturamos?")
    parent["requester"]["data_access"] = True
    await client.post("/v1/requests", json=parent, headers=AUTH)
    await wait_for_end_log(caplog, parent["request_id"])
    return parent


def continuation_of(parent: dict, text: str) -> dict:
    return {
        **parent,
        "request_id": str(uuid.uuid4()),
        "kind": "continuation",
        "parent_request_id": parent["request_id"],
        "message": {"id": str(uuid.uuid4()), "body": text},
    }


async def test_sem_periodo_grava_a_pergunta(
    loaded_business_test: str,
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    await ask_period(request_client, caplog)

    [question] = [call for call in fake_chat_api.requests if is_question(call)]
    assert question["body"]["body"] == "De que período?"
    assert question["body"]["quick_replies"] == ["Este mês", "Mês passado", "Este ano"]
    assert question["body"]["business_data"] is False
    assert not any(is_reply(call) for call in fake_chat_api.requests)


async def test_a_continuacao_mes_passado_responde(
    loaded_business_test: str,
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    parent = await ask_period(request_client, caplog)
    body = continuation_of(parent, "Mês passado")

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "business"
    [reply] = [call for call in fake_chat_api.requests if is_reply(call)]
    assert reply["body"]["body"].startswith("Faturamento de ")
    assert reply["body"]["business_data"] is True


async def test_a_continuacao_que_nao_completa_recebe_nao_entendi(
    loaded_business_test: str,
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from app.agents.assistente.instructions import NAO_ENTENDI_CONSULTA

    parent = await ask_period(request_client, caplog)
    body = continuation_of(parent, "@ana você viu o deploy?")

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    await wait_for_end_log(caplog, body["request_id"])
    [reply] = [call for call in fake_chat_api.requests if is_reply(call)]
    assert reply["body"]["body"].strip() == NAO_ENTENDI_CONSULTA
    assert len([call for call in fake_chat_api.requests if is_question(call)]) == 1
