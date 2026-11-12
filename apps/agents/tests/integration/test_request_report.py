"""O Relatório em PDF pedido ao `assistente`, com o modelo real (spec da F14, "Ferramenta
`gerar_relatorio`"; F14-T04, CA3 e CA5).

Com o app real, o `business_test` carregado, a fila no Redis de teste, a API do chat falsa do
conftest.py e, para a entrega, o job rodado pelo Worker com o S3 do contêiner.
"""

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import httpx
import pytest
from arq import ArqRedis
from sqlalchemy.ext.asyncio import create_async_engine

from app.business.db import BusinessStore, business_engine
from app.business.report_queue import ReportJob, lock_key
from app.chat_api import ChatApiClient
from app.worker.job import WorkerDeps, run_report
from app.worker.storage import ReportStorage
from tests.integration.conftest import FakeChatApi, redis_url_for_tests
from tests.integration.test_request_business import continuation_of
from tests.integration.test_request_routes import AUTH, pedido, wait_for_end_log
from tests.integration.test_worker_job import s3_client

pytestmark = pytest.mark.asyncio(loop_scope="session")


def actions(fake: FakeChatApi, suffix: str) -> list[dict]:
    return [
        call
        for call in fake.requests
        if call["method"] == "POST" and call["path"].endswith(suffix)
    ]


async def queued_job(request_id: str) -> ReportJob:
    queue = ArqRedis.from_url(redis_url_for_tests())
    try:
        job = await queue._get_job_def(request_id.encode(), None)
        return ReportJob.from_payload(job.args[0])
    finally:
        await queue.delete(f"arq:job:{request_id}")
        await queue.aclose()


async def release(requester_id: str) -> None:
    queue = ArqRedis.from_url(redis_url_for_tests())
    await queue.delete(lock_key(requester_id))
    await queue.aclose()


async def test_um_pedido_real_de_relatorio_grava_o_aviso_e_o_worker_entrega_o_pdf(
    loaded_business_test: str,
    test_database_url: str,
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    body = pedido(body="@assistente me manda um relatório de março de 2026 em PDF")
    body["requester"]["data_access"] = True

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "report"
    [notice] = actions(fake_chat_api, "/report-started")
    assert notice["body"]["body"] == (
        "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026. "
        "Ele chega aqui quando ficar pronto."
    )
    job = await queued_job(body["request_id"])
    agents = create_async_engine(test_database_url)
    business = business_engine(loaded_business_test, 3000)
    chat = ChatApiClient(fake_chat_api.url, "credencial-do-worker")
    redis = ArqRedis.from_url(redis_url_for_tests())
    try:
        await run_report(
            WorkerDeps(
                business=BusinessStore(
                    business=business,
                    agents=agents,
                    time_zone=ZoneInfo("America/Sao_Paulo"),
                ),
                chat=chat,
                storage=ReportStorage(s3_client(), os.environ["S3_BUCKET"]),
                redis=redis,
            ),
            job,
            datetime.now(UTC),
        )
    finally:
        await chat.close()
        await redis.aclose()
        await business.dispose()
        await agents.dispose()
    [delivery] = actions(fake_chat_api, "/report-delivered")
    assert delivery["body"]["file_name"] == "relatorio-2026-03-01-a-2026-03-31.pdf"
    assert delivery["body"]["storage_key"] == f"reports/{body['request_id']}.pdf"


async def test_sem_periodo_o_agente_pergunta_e_a_continuacao_gera_o_relatorio(
    loaded_business_test: str,
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    parent = pedido(body="@assistente me manda um relatório em PDF")
    parent["requester"]["data_access"] = True
    await request_client.post("/v1/requests", json=parent, headers=AUTH)
    await wait_for_end_log(caplog, parent["request_id"])
    [question] = actions(fake_chat_api, "/question")
    assert question["body"]["quick_replies"] == ["Este mês", "Mês passado", "Este ano"]
    body = continuation_of(parent, "Mês passado")

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "report"
    [notice] = actions(fake_chat_api, "/report-started")
    assert notice["path"] == f"/v1/bot/requests/{body['request_id']}/report-started"
    assert notice["body"]["body"].startswith("Comecei a gerar o relatório de 01/")
    await queued_job(body["request_id"])
    await release(parent["requester"]["id"])


async def test_um_pedido_real_de_relatorio_filtrado_grava_o_aviso_com_o_filtro(
    loaded_business_test: str,
    request_client: httpx.AsyncClient,
    fake_chat_api: FakeChatApi,
    connected_assistant: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app")
    body = pedido(
        body="@assistente relatório de março de 2026 em PDF da vendedora Ana Paula Ramos"
    )
    body["requester"]["data_access"] = True

    response = await request_client.post("/v1/requests", json=body, headers=AUTH)

    assert response.status_code == 202
    end = await wait_for_end_log(caplog, body["request_id"])
    assert end.desfecho == "report"
    [notice] = actions(fake_chat_api, "/report-started")
    assert notice["body"]["body"] == (
        "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026, vendedor Ana Paula Ramos. "
        "Ele chega aqui quando ficar pronto."
    )
    job = await queued_job(body["request_id"])
    assert job.filter is not None and job.filter.name == "Ana Paula Ramos"
    await release(body["requester"]["id"])
