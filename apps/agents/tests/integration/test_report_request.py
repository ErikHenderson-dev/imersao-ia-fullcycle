"""A ferramenta `gerar_relatorio` sem o modelo (spec da F14, "Ferramenta `gerar_relatorio`";
F14-T04, CA2).

`request_report` é chamada direto, com a auditoria no `agents_test`, a fila e a trava no Redis de
teste e uma API do chat falsa que guarda as ações e, no aviso, se o job já estava na fila.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio
from arq import ArqRedis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.agent_requests import context
from app.business.answer import SEM_PERMISSAO
from app.business.db import BusinessStore, business_engine
from app.business.report_queue import ReportJob, acquire_lock, lock_key
from app.business.report_request import REPORT_IN_PROGRESS, request_report
from tests.integration.conftest import redis_url_for_tests

pytestmark = pytest.mark.asyncio(loop_scope="session")

TZ = ZoneInfo("America/Sao_Paulo")


class FakeClient:
    """Guarda as ações; no aviso, anota se o job do Pedido já estava na fila."""

    def __init__(self, queue: ArqRedis) -> None:
        self.queue = queue
        self.actions: list[dict] = []

    async def reply(
        self, request_id: str, body: str, *, business_data: bool = False
    ) -> None:
        self.actions.append(
            {"action": "reply", "body": body, "business_data": business_data}
        )

    async def report_started(self, request_id: str, body: str) -> None:
        queued = await self.queue.exists(f"arq:job:{request_id}")
        self.actions.append(
            {"action": "report_started", "body": body, "queued": bool(queued)}
        )

    async def report_failed(self, request_id: str) -> None:
        self.actions.append({"action": "report_failed"})


class BrokenQueue:
    """A fila fora: prende a trava no Redis de verdade, mas enfileirar falha."""

    def __init__(self, queue: ArqRedis) -> None:
        self._queue = queue

    def __getattr__(self, name: str):
        return getattr(self._queue, name)

    async def enqueue_job(self, *args, **kwargs):
        raise ConnectionError("Redis fora")


@pytest_asyncio.fixture(loop_scope="session")
async def queue() -> AsyncIterator[ArqRedis]:
    redis = ArqRedis.from_url(redis_url_for_tests())
    yield redis
    await redis.aclose()


@pytest_asyncio.fixture(loop_scope="session")
async def store(
    loaded_business_test: str, test_database_url: str
) -> AsyncIterator[BusinessStore]:
    agents = create_async_engine(test_database_url)
    business = business_engine(loaded_business_test, 3000)
    yield BusinessStore(business=business, agents=agents, time_zone=TZ)
    await business.dispose()
    await agents.dispose()


def tool_context(*, data_access: bool = True) -> SimpleNamespace:
    return SimpleNamespace(
        state={
            context.REQUEST_ID: str(uuid.uuid4()),
            context.REQUESTER_ID: str(uuid.uuid4()),
            context.CONVERSATION_ID: str(uuid.uuid4()),
            context.QUESTION: "@assistente me manda um relatório de março de 2026 em PDF",
            context.DATA_ACCESS: data_access,
            context.BUSINESS_TODAY: "2026-11-12",
            context.REQUESTED_AT: "2026-11-12T17:30:00+00:00",
        },
        actions=SimpleNamespace(skip_summarization=False),
    )


async def audit_of(engine: AsyncEngine, request_id: str) -> list[tuple[str, str]]:
    async with engine.connect() as connection:
        rows = await connection.execute(
            text("SELECT kind, outcome FROM business_queries WHERE request_id = :id"),
            {"id": request_id},
        )
        return [tuple(row) for row in rows]


def answered(ctx: SimpleNamespace) -> bool:
    marker = ctx.state.get(context.ANSWERED_BY_TOOL)
    return bool(
        ctx.actions.skip_summarization and marker and marker["desfecho"] == "report"
    )


async def test_sem_permissao_de_dados_grava_a_recusa_e_audita_sem_prender_a_trava(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context(data_access=False)
    client = FakeClient(queue)

    await request_report(client, store, queue, ctx, "2026-03-01", "2026-03-31")

    assert client.actions == [
        {"action": "reply", "body": SEM_PERMISSAO, "business_data": False}
    ]
    assert await audit_of(store.agents, ctx.state[context.REQUEST_ID]) == [
        ("report", "no_permission")
    ]
    assert await queue.get(lock_key(ctx.state[context.REQUESTER_ID])) is None
    assert answered(ctx)


@pytest.mark.parametrize(
    ("inicio", "fim"), [("março", "2026-03-31"), ("2026-03-31", "2026-03-01")]
)
async def test_datas_invalidas_voltam_ao_modelo_como_erro(
    store: BusinessStore, queue: ArqRedis, inicio: str, fim: str
) -> None:
    ctx = tool_context()
    client = FakeClient(queue)

    result = await request_report(client, store, queue, ctx, inicio, fim)

    assert "erro" in result
    assert client.actions == []
    assert await audit_of(store.agents, ctx.state[context.REQUEST_ID]) == []
    assert not answered(ctx)


async def test_com_a_trava_presa_grava_a_recusa_de_relatorio_em_andamento(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    requester = ctx.state[context.REQUESTER_ID]
    other = str(uuid.uuid4())
    await acquire_lock(queue, requester, other)
    client = FakeClient(queue)

    await request_report(client, store, queue, ctx, "2026-03-01", "2026-03-31")

    assert client.actions == [
        {"action": "reply", "body": REPORT_IN_PROGRESS, "business_data": False}
    ]
    assert await audit_of(store.agents, ctx.state[context.REQUEST_ID]) == []
    assert (await queue.get(lock_key(requester))).decode() == other
    assert answered(ctx)
    await queue.delete(lock_key(requester))


async def test_o_aviso_e_gravado_antes_de_o_job_entrar_na_fila(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    request_id = ctx.state[context.REQUEST_ID]
    requester = ctx.state[context.REQUESTER_ID]
    client = FakeClient(queue)

    await request_report(client, store, queue, ctx, "2026-03-01", "2026-03-31")

    assert client.actions == [
        {
            "action": "report_started",
            "body": "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026. "
            "Ele chega aqui quando ficar pronto.",
            "queued": False,
        }
    ]
    job = await queue._get_job_def(request_id.encode(), None)
    payload = ReportJob.from_payload(job.args[0])
    assert (
        payload.previous_period.start.isoformat(),
        payload.previous_period.end.isoformat(),
    ) == (
        "2026-02-01",
        "2026-02-28",
    )
    assert (await queue.get(lock_key(requester))).decode() == request_id
    assert answered(ctx)
    await queue.delete(lock_key(requester), f"arq:job:{request_id}")


async def test_uma_falha_ao_enfileirar_grava_report_failed_e_solta_a_trava(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    client = FakeClient(queue)

    await request_report(
        client,
        store,
        BrokenQueue(queue),
        ctx,
        "2026-03-01",
        "2026-03-31",  # type: ignore[arg-type]
    )

    assert [action["action"] for action in client.actions] == [
        "report_started",
        "report_failed",
    ]
    assert await audit_of(store.agents, ctx.state[context.REQUEST_ID]) == [
        ("report", "error")
    ]
    assert await queue.get(lock_key(ctx.state[context.REQUESTER_ID])) is None
