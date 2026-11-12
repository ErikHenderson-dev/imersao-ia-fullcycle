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

    async def question(
        self,
        request_id: str,
        body: str,
        quick_replies: list[str],
        *,
        business_data: bool = False,
    ) -> None:
        self.actions.append(
            {
                "action": "question",
                "body": body,
                "quick_replies": quick_replies,
                "business_data": business_data,
            }
        )


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


def tool_context(*, data_access: bool = True, kind: str = "new") -> SimpleNamespace:
    return SimpleNamespace(
        state={
            context.KIND: kind,
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


# O filtro por nome (F14-T05, CA1 e CA2): a busca da F13, com os nomes repetidos de propósito nos
# dados fixos (dois vendedores com "Ana", seis clientes com "Silva").


async def lock_is_free(queue: ArqRedis, ctx: SimpleNamespace) -> bool:
    return await queue.get(lock_key(ctx.state[context.REQUESTER_ID])) is None


async def test_um_nome_sem_achado_grava_nao_encontrei_e_solta_a_trava(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    client = FakeClient(queue)

    await request_report(
        client, store, queue, ctx, "2026-03-01", "2026-03-31", "vendedor", "Zé Ninguém"
    )

    assert client.actions == [
        {
            "action": "reply",
            "body": "Não encontrei vendedor Zé Ninguém.",
            "business_data": True,
        }
    ]
    assert await audit_of(store.agents, ctx.state[context.REQUEST_ID]) == [
        ("report", "not_found")
    ]
    assert await lock_is_free(queue, ctx)
    assert answered(ctx)


async def test_um_nome_generico_demais_pede_um_nome_mais_completo(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    client = FakeClient(queue)

    await request_report(
        client, store, queue, ctx, "2026-03-01", "2026-03-31", "cliente", "Silva"
    )

    [action] = client.actions
    assert action["action"] == "reply"
    assert action["body"].startswith("Há mais de cinco clientes com Silva.")
    assert action["business_data"] is True
    assert await audit_of(store.agents, ctx.state[context.REQUEST_ID]) == [
        ("report", "too_generic")
    ]
    assert await lock_is_free(queue, ctx)


async def test_um_nome_repetido_pergunta_qual_com_um_botao_por_nome(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    client = FakeClient(queue)

    await request_report(
        client, store, queue, ctx, "2026-03-01", "2026-03-31", "vendedor", "Ana"
    )

    [action] = client.actions
    assert action == {
        "action": "question",
        "body": "Qual Ana?",
        "quick_replies": ["Ana Beatriz Costa", "Ana Paula Ramos"],
        "business_data": True,
    }
    assert await audit_of(store.agents, ctx.state[context.REQUEST_ID]) == [
        ("report", "ambiguous_name")
    ]
    assert await lock_is_free(queue, ctx)


async def test_na_continuacao_o_nome_repetido_nao_pergunta_de_novo(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context(kind="continuation")
    client = FakeClient(queue)

    await request_report(
        client, store, queue, ctx, "2026-03-01", "2026-03-31", "vendedor", "Ana"
    )

    [action] = client.actions
    assert action["action"] == "reply"
    assert action["body"].startswith("Não consegui identificar vendedor Ana.")
    assert await lock_is_free(queue, ctx)


@pytest.mark.parametrize(
    ("filtro_tipo", "filtro_nome"),
    [("vendedor", None), (None, "Ana"), ("fornecedor", "Ana"), ("vendedor", "  ")],
)
async def test_filtro_incompleto_volta_ao_modelo_como_erro(
    store: BusinessStore,
    queue: ArqRedis,
    filtro_tipo: str | None,
    filtro_nome: str | None,
) -> None:
    ctx = tool_context()
    client = FakeClient(queue)

    result = await request_report(
        client, store, queue, ctx, "2026-03-01", "2026-03-31", filtro_tipo, filtro_nome
    )

    assert "erro" in result
    assert client.actions == []
    assert await lock_is_free(queue, ctx)


async def test_um_nome_com_um_achado_leva_o_filtro_pelo_id_ao_job(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    request_id = ctx.state[context.REQUEST_ID]
    client = FakeClient(queue)

    await request_report(
        client, store, queue, ctx, "2026-03-01", "2026-03-31", "vendedor", "Ana Paula"
    )

    [notice] = client.actions
    assert notice["body"] == (
        "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026, vendedor Ana Paula Ramos. "
        "Ele chega aqui quando ficar pronto."
    )
    job = ReportJob.from_payload(
        (await queue._get_job_def(request_id.encode(), None)).args[0]
    )
    assert job.filter is not None
    assert (job.filter.type, job.filter.name) == ("vendedor", "Ana Paula Ramos")
    async with store.business.connect() as connection:
        seller_id = (
            await connection.execute(
                text("SELECT id FROM sellers WHERE name = 'Ana Paula Ramos'")
            )
        ).scalar_one()
    assert job.filter.id == seller_id
    await queue.delete(
        lock_key(ctx.state[context.REQUESTER_ID]), f"arq:job:{request_id}"
    )


# A trava solta em toda falha antes do job, e a segunda chamada no mesmo Pedido (revisão da F14-T04).


async def test_um_periodo_que_ainda_nao_comecou_volta_ao_modelo_como_erro(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    client = FakeClient(queue)

    result = await request_report(client, store, queue, ctx, "2026-12-01", "2026-12-31")

    assert "erro" in result
    assert client.actions == []
    assert await lock_is_free(queue, ctx)


async def test_a_segunda_chamada_no_mesmo_pedido_nao_grava_nada(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    request_id = ctx.state[context.REQUEST_ID]
    client = FakeClient(queue)
    await request_report(client, store, queue, ctx, "2026-03-01", "2026-03-31")

    await request_report(client, store, queue, ctx, "2026-04-01", "2026-04-30")

    assert [action["action"] for action in client.actions] == ["report_started"]
    assert answered(ctx)
    await queue.delete(lock_key(ctx.state[context.REQUESTER_ID]), f"arq:job:{request_id}")


async def test_uma_chamada_em_paralelo_no_mesmo_pedido_volta_ao_modelo(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    requester = ctx.state[context.REQUESTER_ID]
    await acquire_lock(queue, requester, ctx.state[context.REQUEST_ID])
    client = FakeClient(queue)

    result = await request_report(client, store, queue, ctx, "2026-03-01", "2026-03-31")

    assert "erro" in result
    assert client.actions == []
    assert not answered(ctx)
    await queue.delete(lock_key(requester))


class FailingNoticeClient(FakeClient):
    async def report_started(self, request_id: str, body: str) -> None:
        raise ConnectionError("API do chat fora")


async def test_uma_falha_no_aviso_solta_a_trava(
    store: BusinessStore, queue: ArqRedis
) -> None:
    ctx = tool_context()
    client = FailingNoticeClient(queue)

    with pytest.raises(ConnectionError):
        await request_report(client, store, queue, ctx, "2026-03-01", "2026-03-31")

    assert await lock_is_free(queue, ctx)
