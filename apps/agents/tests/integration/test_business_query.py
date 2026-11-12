"""A ferramenta de consulta contra o Banco de negócio de teste (spec da F13, "Catálogo e consulta",
"Auditoria" e "O Agente `assistente`"; F13-T04, CA3 a CA6).

Sem o modelo: `consult` é chamada direto, com o `business_test` carregado pela carga fixa, a
auditoria no `agents_test` e uma API do chat falsa que guarda as `reply`. Os números esperados
saem de SQL escrito à mão neste arquivo, e não do catálogo.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from decimal import Decimal
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.agent_requests import context
from app.business import consult as consult_module
from app.business.answer import (
    NAO_CONSEGUI_RESPONDER,
    SEM_PERMISSAO,
    format_count,
    format_money,
)
from app.business.consult import consult
from app.business.db import BusinessStore, business_engine

pytestmark = pytest.mark.asyncio(loop_scope="session")

TZ = ZoneInfo("America/Sao_Paulo")
# Março de 2026 no fuso da empresa, à mão.
MARCH = "ordered_at >= '2026-03-01 00:00-03' AND ordered_at < '2026-04-01 00:00-03'"


class FakeClient:
    def __init__(self) -> None:
        self.replies: list[dict] = []

    async def reply(
        self, request_id: str, body: str, *, business_data: bool = False
    ) -> None:
        self.replies.append(
            {"request_id": request_id, "body": body, "business_data": business_data}
        )


@pytest_asyncio.fixture(loop_scope="session")
async def agents_engine(test_database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(test_database_url)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def store(
    loaded_business_test: str, agents_engine: AsyncEngine
) -> AsyncIterator[BusinessStore]:
    business = business_engine(loaded_business_test, 3000)
    yield BusinessStore(business=business, agents=agents_engine, time_zone=TZ)
    await business.dispose()


def tool_context(*, data_access: bool = True) -> SimpleNamespace:
    return SimpleNamespace(
        state={
            context.REQUEST_ID: str(uuid.uuid4()),
            context.REQUESTER_ID: str(uuid.uuid4()),
            context.CONVERSATION_ID: str(uuid.uuid4()),
            context.QUESTION: "@assistente quanto faturamos em março de 2026?",
            context.DATA_ACCESS: data_access,
        },
        actions=SimpleNamespace(skip_summarization=False),
    )


async def scalar(engine: AsyncEngine, sql: str) -> object:
    async with engine.connect() as connection:
        return (await connection.execute(text(sql))).scalar_one()


async def audit_of(engine: AsyncEngine, request_id: str) -> list[dict]:
    async with engine.connect() as connection:
        rows = await connection.execute(
            text("SELECT * FROM business_queries WHERE request_id = :id"),
            {"id": request_id},
        )
        return [dict(row._mapping) for row in rows]


EXPECTED_SQL = {
    "faturamento": f"SELECT sum(net_amount) FROM orders WHERE status = 'paid' AND {MARCH}",
    "pedidos": f"SELECT count(*) FROM orders WHERE status = 'paid' AND {MARCH}",
    "ticket_medio": f"SELECT round(avg(net_amount), 2) FROM orders WHERE status = 'paid' AND {MARCH}",
    "clientes_ativos": (
        "SELECT count(DISTINCT customer_id) FROM orders WHERE status = 'paid' "
        "AND ordered_at >= '2026-01-01 00:00-03' AND ordered_at < '2026-04-01 00:00-03'"
    ),
    "clientes_novos": (
        "SELECT count(*) FROM customers WHERE created_at >= '2026-03-01 00:00-03' "
        "AND created_at < '2026-04-01 00:00-03'"
    ),
    "itens_vendidos": (
        "SELECT sum(i.quantity) FROM order_items i JOIN orders o ON o.id = i.order_id "
        f"WHERE o.status = 'paid' AND o.{MARCH}"
    ),
}


@pytest.mark.parametrize("metric", sorted(EXPECTED_SQL))
async def test_cada_metrica_responde_o_numero_calculado_a_mao(
    store: BusinessStore, metric: str
) -> None:
    expected = await scalar(store.business, EXPECTED_SQL[metric])
    client, ctx = FakeClient(), tool_context()

    await consult(client, store, ctx, metric, "2026-03-01", "2026-03-31")  # type: ignore[arg-type]

    [reply] = client.replies
    shown = (
        format_money(Decimal(expected))  # type: ignore[arg-type]
        if metric in ("faturamento", "ticket_medio")
        else format_count(int(expected))  # type: ignore[arg-type]
    )
    assert f": {shown}." in reply["body"]
    assert reply["business_data"] is True
    assert ctx.state[context.ANSWERED_BY_TOOL]["desfecho"] == "business"
    [row] = await audit_of(store.agents, ctx.state[context.REQUEST_ID])
    assert row["outcome"] == "answered"


async def test_a_resposta_grava_a_auditoria_sem_o_resultado(
    store: BusinessStore,
) -> None:
    client, ctx = FakeClient(), tool_context()

    await consult(client, store, ctx, "faturamento", "2026-03-01", "2026-03-31")  # type: ignore[arg-type]

    [row] = await audit_of(store.agents, ctx.state[context.REQUEST_ID])
    assert row["requester_id"] == uuid.UUID(ctx.state[context.REQUESTER_ID])
    assert row["conversation_id"] == uuid.UUID(ctx.state[context.CONVERSATION_ID])
    assert row["question"] == ctx.state[context.QUESTION]
    assert row["params"] == {
        "metrica": "faturamento",
        "inicio": "2026-03-01",
        "fim": "2026-03-31",
        "bruto": False,
    }
    assert row["sql"].startswith("SELECT sum(orders.net_amount)")
    # Nem o número nem o texto da resposta vão para a auditoria.
    number = client.replies[0]["body"].split(": ")[1].split(".\n")[0]
    assert number not in str(row)


async def test_sem_permissao_de_dados_grava_a_recusa_e_nao_consulta(
    store: BusinessStore, test_database_url: str
) -> None:
    # Um Banco de negócio que não existe: qualquer consulta falharia.
    unreachable = BusinessStore(
        business=business_engine(
            "postgresql+asyncpg://ninguem:x@127.0.0.1:9/nada", 3000
        ),
        agents=store.agents,
        time_zone=TZ,
    )
    client, ctx = FakeClient(), tool_context(data_access=False)

    await consult(client, unreachable, ctx, "faturamento", "2026-03-01", "2026-03-31")  # type: ignore[arg-type]

    assert client.replies == [
        {
            "request_id": ctx.state[context.REQUEST_ID],
            "body": SEM_PERMISSAO,
            "business_data": False,
        }
    ]
    [row] = await audit_of(store.agents, ctx.state[context.REQUEST_ID])
    assert row["outcome"] == "no_permission"
    assert row["sql"] is None


async def test_estourar_o_tempo_limite_da_nao_consegui_com_error_na_auditoria(
    store: BusinessStore, loaded_business_test: str
) -> None:
    slow = BusinessStore(
        business=business_engine(loaded_business_test, 1),
        agents=store.agents,
        time_zone=TZ,
    )
    client, ctx = FakeClient(), tool_context()
    try:
        await consult(client, slow, ctx, "itens_vendidos", "2025-01-01", "2026-10-31")  # type: ignore[arg-type]
    finally:
        await slow.dispose()

    assert [reply["body"] for reply in client.replies] == [NAO_CONSEGUI_RESPONDER]
    assert client.replies[0]["business_data"] is False
    [row] = await audit_of(store.agents, ctx.state[context.REQUEST_ID])
    assert row["outcome"] == "error"


async def test_um_numero_sem_lastro_vira_nao_consegui_com_lastro_blocked(
    store: BusinessStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = consult_module.answer_text
    monkeypatch.setattr(
        consult_module,
        "answer_text",
        lambda *args, **kwargs: (
            original(*args, **kwargs) + " Fevereiro: R$ 999.999,99."
        ),
    )
    client, ctx = FakeClient(), tool_context()

    await consult(client, store, ctx, "faturamento", "2026-03-01", "2026-03-31")  # type: ignore[arg-type]

    assert [reply["body"] for reply in client.replies] == [NAO_CONSEGUI_RESPONDER]
    [row] = await audit_of(store.agents, ctx.state[context.REQUEST_ID])
    assert row["outcome"] == "lastro_blocked"


async def test_a_falha_da_auditoria_nao_deixa_resposta_com_numero(
    store: BusinessStore,
) -> None:
    broken = BusinessStore(
        business=store.business,
        agents=create_async_engine("postgresql+asyncpg://ninguem:x@127.0.0.1:9/nada"),
        time_zone=TZ,
    )
    client, ctx = FakeClient(), tool_context()

    with pytest.raises(OSError):
        await consult(client, broken, ctx, "faturamento", "2026-03-01", "2026-03-31")  # type: ignore[arg-type]

    # A exceção sobe, e o fim do Pedido grava o "não consegui" (execution.execute).
    assert client.replies == []
    await broken.agents.dispose()


async def test_o_parametro_invalido_volta_ao_modelo_sem_consulta(
    store: BusinessStore,
) -> None:
    client, ctx = FakeClient(), tool_context()

    result = await consult(client, store, ctx, "lucro", "2026-03-01", "2026-03-31")  # type: ignore[arg-type]

    assert "erro" in result
    assert client.replies == []
    assert await audit_of(store.agents, ctx.state[context.REQUEST_ID]) == []
