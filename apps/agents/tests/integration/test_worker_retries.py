"""As falhas e as novas tentativas do Relatório no Worker (spec da F14, "Fila e job" e "Worker de
agentes"; F14-T06, CA1 a CA3).

`generate_report` roda como o arq a chama, com a tentativa em `ctx["job_try"]`, contra o Banco de
negócio de teste, a API do chat falsa e o S3 do contêiner. A falha do S3 e a demora são dublês do
armazenamento; o resto é real.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from dataclasses import replace

import pytest
from arq import Retry
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from app.business.report_queue import acquire_lock, lock_key
from app.worker import job as worker_job
from app.worker.job import WorkerDeps, generate_report
from app.worker.storage import ReportStorage, report_key
from tests.integration.conftest import FakeChatApi, s3_client
from tests.integration.test_worker_job import audit_rows, new_job

pytestmark = pytest.mark.asyncio(loop_scope="session")


class FlakyStorage(ReportStorage):
    """O S3 que falha nas primeiras `failures` gravações, ou demora `delay_s` em cada uma."""

    def __init__(self, failures: int = 0, delay_s: float = 0) -> None:
        super().__init__(s3_client(), os.environ["S3_BUCKET"])
        self.failures = failures
        self.delay_s = delay_s

    async def put_pdf(self, key: str, body: bytes) -> None:
        await asyncio.sleep(self.delay_s)
        if self.failures > 0:
            self.failures -= 1
            raise ConnectionError("S3 fora")
        await super().put_pdf(key, body)


def with_storage(deps: WorkerDeps, storage: ReportStorage) -> WorkerDeps:
    return replace(deps, storage=storage)


def posts(fake: FakeChatApi, suffix: str) -> list[dict]:
    return [
        r for r in fake.requests if r["method"] == "POST" and r["path"].endswith(suffix)
    ]


async def test_uma_falha_no_s3_e_sucesso_na_segunda_tentativa_entregam_uma_vez_so_na_mesma_chave(
    deps: WorkerDeps,
    fake_chat_api: FakeChatApi,
    agents_engine: AsyncEngine,
    redis: Redis,
) -> None:
    job = new_job()
    await acquire_lock(redis, job.requester_id, job.request_id)
    ctx = {"deps": with_storage(deps, FlakyStorage(failures=1)), "job_try": 1}
    with pytest.raises(Retry) as first:
        await generate_report(ctx, job.to_payload())
    assert first.value.defer_score == 5_000
    assert fake_chat_api.requests == []
    assert await audit_rows(agents_engine, job.request_id) == []

    await generate_report({**ctx, "job_try": 2}, job.to_payload())

    assert len(posts(fake_chat_api, "/report-delivered")) == 1
    assert [row.outcome for row in await audit_rows(agents_engine, job.request_id)] == [
        "delivered"
    ]
    s3_client().head_object(
        Bucket=os.environ["S3_BUCKET"], Key=report_key(job.request_id)
    )
    assert await redis.get(lock_key(job.requester_id)) is None


async def test_a_segunda_falha_espera_mais_antes_da_terceira(deps: WorkerDeps) -> None:
    job = new_job()
    ctx = {"deps": with_storage(deps, FlakyStorage(failures=1)), "job_try": 2}

    with pytest.raises(Retry) as second:
        await generate_report(ctx, job.to_payload())

    assert second.value.defer_score == 15_000


async def test_uma_tentativa_que_passa_do_tempo_limite_volta_a_fila(
    deps: WorkerDeps, fake_chat_api: FakeChatApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(worker_job, "ATTEMPT_TIMEOUT_S", 0.2)
    job = new_job()
    ctx = {"deps": with_storage(deps, FlakyStorage(delay_s=1)), "job_try": 1}

    with pytest.raises(Retry):
        await generate_report(ctx, job.to_payload())

    assert fake_chat_api.requests == []


async def test_tentativas_esgotadas_gravam_report_failed_auditam_error_e_soltam_a_trava(
    deps: WorkerDeps,
    fake_chat_api: FakeChatApi,
    agents_engine: AsyncEngine,
    redis: Redis,
) -> None:
    job = new_job()
    await acquire_lock(redis, job.requester_id, job.request_id)
    ctx = {"deps": with_storage(deps, FlakyStorage(failures=1)), "job_try": 3}

    await generate_report(ctx, job.to_payload())

    assert [r["path"] for r in fake_chat_api.requests] == [
        f"/v1/bot/requests/{job.request_id}/report-failed"
    ]
    rows = await audit_rows(agents_engine, job.request_id)
    assert [(row.kind, row.outcome) for row in rows] == [("report", "error")]
    assert await redis.get(lock_key(job.requester_id)) is None


async def test_sem_lastro_nao_ha_nova_tentativa(
    deps: WorkerDeps, fake_chat_api: FakeChatApi, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(worker_job, "allowed_numbers", lambda *_: set())
    job = new_job()

    await generate_report({"deps": deps, "job_try": 1}, job.to_payload())

    assert [r["path"] for r in fake_chat_api.requests] == [
        f"/v1/bot/requests/{job.request_id}/report-failed"
    ]


@pytest.mark.parametrize(
    "refusal",
    [(404, "request_not_found"), (409, "request_closed"), (410, "request_expired")],
)
async def test_um_pedido_recusado_encerra_o_job_sem_nova_tentativa_e_solta_a_trava(
    deps: WorkerDeps,
    fake_chat_api: FakeChatApi,
    redis: Redis,
    caplog: pytest.LogCaptureFixture,
    refusal: tuple[int, str],
) -> None:
    job = new_job()
    await acquire_lock(redis, job.requester_id, job.request_id)
    fake_chat_api.failures["/report-delivered"] = [refusal]
    caplog.set_level("INFO", logger="app")

    await generate_report({"deps": deps, "job_try": 1}, job.to_payload())

    assert posts(fake_chat_api, "/report-failed") == []
    assert await redis.get(lock_key(job.requester_id)) is None
    assert any(
        getattr(record, "request_id", None) == job.request_id
        for record in caplog.records
    )


async def test_uma_trava_de_outro_pedido_fica_na_falha_final(
    deps: WorkerDeps, redis: Redis
) -> None:
    job = new_job()
    other = str(uuid.uuid4())
    await acquire_lock(redis, job.requester_id, other)
    ctx = {"deps": with_storage(deps, FlakyStorage(failures=1)), "job_try": 3}

    await generate_report(ctx, job.to_payload())

    assert await redis.get(lock_key(job.requester_id)) == other
    await redis.delete(lock_key(job.requester_id))
