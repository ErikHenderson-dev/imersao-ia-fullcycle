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
