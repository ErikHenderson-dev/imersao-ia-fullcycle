"""O job do Relatório no Worker, contra o Banco de negócio de teste, a API do chat falsa e o S3 do
contêiner (F14-T03, CA5 a CA7).

O gabarito de cada Métrica sai de SQL escrito no próprio teste, independente do catálogo.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import replace
from datetime import UTC, date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from arq import create_pool
from arq.connections import RedisSettings
from botocore.exceptions import ClientError
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.business.answer import format_count, format_money, format_percent, variation
from app.business.catalog import Period
from app.business.report_queue import (
    ReportFilter,
    ReportJob,
    acquire_lock,
    enqueue_report,
    lock_key,
)
from app.worker import job as worker_job
from app.worker.job import WorkerDeps, run_report
from app.worker.pdf import pdf_text
from app.worker.storage import ReportStorage, report_key
from tests.integration.conftest import FakeChatApi, redis_url_for_tests, s3_client

TZ = ZoneInfo("America/Sao_Paulo")
MARCH = Period(date(2026, 3, 1), date(2026, 3, 31))
FEBRUARY = Period(date(2026, 2, 1), date(2026, 2, 28))
JULY = Period(date(2026, 7, 1), date(2026, 7, 31))
JUNE = Period(date(2026, 6, 1), date(2026, 6, 30))
NOW = datetime(2026, 11, 12, 17, 32, tzinfo=UTC)

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def seller(url: str, name: str | None = None) -> tuple[int, str]:
    """Um vendedor dos dados fixos: o de nome dado, ou o primeiro."""
    engine = create_async_engine(url)
    try:
        async with engine.connect() as connection:
            query = "SELECT id, name FROM sellers " + (
                "WHERE name = :name" if name else "ORDER BY id LIMIT 1"
            )
            found = (await connection.execute(text(query), {"name": name})).one()
            return found.id, found.name
    finally:
        await engine.dispose()


def new_job(
    period: Period = MARCH,
    previous: Period = FEBRUARY,
    filter: ReportFilter | None = None,
) -> ReportJob:
    return ReportJob(
        request_id=str(uuid.uuid4()),
        requester_id=str(uuid.uuid4()),
        conversation_id=str(uuid.uuid4()),
        question="@assistente me manda um relatório de março de 2026 em PDF",
        period=period,
        previous_period=previous,
        filter=filter,
        requested_at=NOW,
    )


def stored_pdf_text(request_id: str) -> str:
    body = s3_client().get_object(
        Bucket=os.environ["S3_BUCKET"], Key=report_key(request_id)
    )
    return pdf_text(body["Body"].read())


async def audit_rows(engine: AsyncEngine, request_id: str) -> list:
    async with engine.connect() as connection:
        result = await connection.execute(
            text(
                "SELECT kind, outcome, sql, created_at FROM business_queries "
                "WHERE request_id = :id"
            ),
            {"id": request_id},
        )
        return list(result)


async def gabarito(url: str, period: Period, seller_id: int | None = None) -> dict:
    """As seis Métricas por SQL próprio: pedidos pagos no intervalo do fuso da empresa."""
    start = datetime(period.start.year, period.start.month, period.start.day, tzinfo=TZ)
    end_day = period.end.toordinal() + 1
    end = datetime.combine(date.fromordinal(end_day), datetime.min.time(), tzinfo=TZ)
    active_start = datetime.combine(
        date.fromordinal(period.end.toordinal() - 89), datetime.min.time(), tzinfo=TZ
    )
    seller = "AND seller_id = :seller" if seller_id is not None else ""
    params = {"start": start, "end": end, "active": active_start, "seller": seller_id}
    engine = create_async_engine(url)
    try:
        async with engine.connect() as connection:
            orders = (
                await connection.execute(
                    text(
                        "SELECT count(*) AS n, sum(net_amount) AS net FROM orders "
                        f"WHERE status = 'paid' AND ordered_at >= :start AND ordered_at < :end {seller}"
                    ),
                    params,
                )
            ).one()
            items = (
                await connection.execute(
                    text(
                        "SELECT coalesce(sum(i.quantity), 0) FROM order_items i "
                        "JOIN orders o ON o.id = i.order_id WHERE o.status = 'paid' "
                        f"AND o.ordered_at >= :start AND o.ordered_at < :end {seller.replace('seller_id', 'o.seller_id')}"
                    ),
                    params,
                )
            ).scalar_one()
            active = (
                await connection.execute(
                    text(
                        "SELECT count(DISTINCT customer_id) FROM orders WHERE status = 'paid' "
                        f"AND ordered_at >= :active AND ordered_at < :end {seller}"
                    ),
                    params,
                )
            ).scalar_one()
            new = (
                await connection.execute(
                    text(
                        "SELECT count(*) FROM customers WHERE created_at >= :start AND created_at < :end"
                    ),
                    params,
                )
            ).scalar_one()
    finally:
        await engine.dispose()
    net = Decimal(orders.net or 0).quantize(Decimal("0.01"))
    ticket = (
        None
        if orders.n == 0
        else (Decimal(orders.net) / orders.n).quantize(Decimal("0.01"))
    )
    return {
        "Faturamento líquido": ("money", net),
        "Pedidos": ("count", orders.n),
        "Ticket médio": ("money", ticket),
        "Clientes ativos": ("count", active),
        "Clientes novos": ("count", new),
        "Itens vendidos": ("count", int(items)),
    }


def expected_line(label: str, current: tuple, previous: tuple) -> str:
    kind, now = current
    _, before = previous

    def shown(value: object) -> str:
        if value is None:
            return "sem pedidos pagos"
        return format_money(value) if kind == "money" else format_count(value)

    change = None if now is None or before is None else variation(now, before)
    shown_change = (
        "sem variação percentual" if change is None else format_percent(change)
    )
    return f"{label}  {shown(now)}  {shown(before)}  {shown_change}"


async def test_o_pdf_de_marco_traz_as_seis_metricas_do_gabarito(
    deps: WorkerDeps, loaded_business_test: str
) -> None:
    job = new_job()

    await run_report(deps, job, NOW)

    content = stored_pdf_text(job.request_id)
    current = await gabarito(loaded_business_test, MARCH)
    previous = await gabarito(loaded_business_test, FEBRUARY)
    for label in current:
        assert expected_line(label, current[label], previous[label]) in content
    assert "Março de 2026" in content


async def test_com_filtro_de_vendedor_clientes_novos_nao_se_aplica(
    deps: WorkerDeps, loaded_business_test: str
) -> None:
    seller_id, seller_name = await seller(loaded_business_test)
    job = new_job(filter=ReportFilter("vendedor", seller_id, seller_name))

    await run_report(deps, job, NOW)

    content = stored_pdf_text(job.request_id)
    current = await gabarito(loaded_business_test, MARCH, seller_id)
    previous = await gabarito(loaded_business_test, FEBRUARY, seller_id)
    assert f"Março de 2026 · vendedor {seller_name}" in content
    assert "Clientes novos  não se aplica  não se aplica  não se aplica" in content
    for label in ("Faturamento líquido", "Pedidos", "Ticket médio", "Itens vendidos"):
        assert expected_line(label, current[label], previous[label]) in content


async def test_um_periodo_sem_pedidos_pagos_mostra_zero_e_sem_pedidos_pagos(
    deps: WorkerDeps, loaded_business_test: str
) -> None:
    # A vendedora sem pedidos em julho de 2026, de propósito, nos dados fixos (app/business/load.py).
    seller_id, _ = await seller(loaded_business_test, "Ana Paula Ramos")
    job = new_job(JULY, JUNE, ReportFilter("vendedor", seller_id, "Ana Paula Ramos"))

    await run_report(deps, job, NOW)

    content = stored_pdf_text(job.request_id)
    assert "Ticket médio  sem pedidos pagos" in content
    assert "Pedidos  0  " in content
    assert "Faturamento líquido  R$ 0,00  " in content


async def test_o_job_grava_o_pdf_no_s3_audita_e_entrega(
    deps: WorkerDeps,
    fake_chat_api: FakeChatApi,
    agents_engine: AsyncEngine,
    redis: Redis,
) -> None:
    job = new_job()
    await acquire_lock(redis, job.requester_id, job.request_id)

    await run_report(deps, job, NOW)

    stored = s3_client().head_object(
        Bucket=os.environ["S3_BUCKET"], Key=report_key(job.request_id)
    )
    assert stored["ContentType"] == "application/pdf"
    [row] = await audit_rows(agents_engine, job.request_id)
    assert (row.kind, row.outcome) == ("report", "delivered")
    assert len(row.sql.split("\n\n")) == 2
    [delivery] = [
        r for r in fake_chat_api.requests if r["path"].endswith("/report-delivered")
    ]
    assert delivery["path"] == f"/v1/bot/requests/{job.request_id}/report-delivered"
    assert delivery["authorization"] == "Bearer credencial-do-worker"
    assert delivery["body"] == {
        "storage_key": report_key(job.request_id),
        "file_name": "relatorio-2026-03-01-a-2026-03-31.pdf",
        "size_bytes": stored["ContentLength"],
    }
    assert row.created_at <= delivery["received_at"]
    assert await redis.get(lock_key(job.requester_id)) is None


async def test_a_trava_de_outro_pedido_fica(deps: WorkerDeps, redis: Redis) -> None:
    job = new_job()
    other = str(uuid.uuid4())
    await acquire_lock(redis, job.requester_id, other)

    await run_report(deps, job, NOW)

    assert await redis.get(lock_key(job.requester_id)) == other
    await redis.delete(lock_key(job.requester_id))


async def test_sem_lastro_nada_e_entregue(
    deps: WorkerDeps,
    fake_chat_api: FakeChatApi,
    agents_engine: AsyncEngine,
    redis: Redis,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    job = new_job()
    await acquire_lock(redis, job.requester_id, job.request_id)
    # O lastro sem nenhum número permitido: todo número do PDF fica sem lastro.
    monkeypatch.setattr(worker_job, "allowed_numbers", lambda *_: set())

    await run_report(deps, job, NOW)

    paths = [r["path"] for r in fake_chat_api.requests]
    assert paths == [f"/v1/bot/requests/{job.request_id}/report-failed"]
    [row] = await audit_rows(agents_engine, job.request_id)
    assert (row.kind, row.outcome) == ("report", "lastro_blocked")
    with pytest.raises(ClientError):
        s3_client().head_object(
            Bucket=os.environ["S3_BUCKET"], Key=report_key(job.request_id)
        )
    assert await redis.get(lock_key(job.requester_id)) is None


async def test_o_bucket_e_criado_na_subida_com_s3_create_bucket() -> None:
    bucket = f"reports-teste-{uuid.uuid4().hex[:8]}"
    storage = ReportStorage(s3_client(), bucket)

    await storage.ensure_bucket()

    s3_client().head_bucket(Bucket=bucket)
    s3_client().delete_bucket(Bucket=bucket)


async def test_o_mesmo_pedido_enfileirado_duas_vezes_gera_um_job_so() -> None:
    queue = await create_pool(RedisSettings.from_dsn(redis_url_for_tests()))
    job = replace(new_job(), request_id=str(uuid.uuid4()))
    try:
        first = await enqueue_report(queue, job)

        second = await enqueue_report(queue, job)

        assert (first, second) == (True, False)
    finally:
        await queue.delete(f"arq:job:{job.request_id}")
        await queue.aclose()


async def test_com_filtro_de_produto_so_pedidos_e_itens_vendidos_se_aplicam(
    deps: WorkerDeps, loaded_business_test: str
) -> None:
    engine = create_async_engine(loaded_business_test)
    try:
        async with engine.connect() as connection:
            product_id, product_name = (
                await connection.execute(
                    text("SELECT id, name FROM products ORDER BY id LIMIT 1")
                )
            ).one()
            orders = (
                await connection.execute(
                    text(
                        "SELECT count(*) FROM orders WHERE status = 'paid' "
                        "AND ordered_at >= '2026-03-01 00:00-03' AND ordered_at < '2026-04-01 00:00-03' "
                        "AND id IN (SELECT order_id FROM order_items WHERE product_id = :p)"
                    ),
                    {"p": product_id},
                )
            ).scalar_one()
    finally:
        await engine.dispose()
    job = new_job(filter=ReportFilter("produto", product_id, product_name))

    await run_report(deps, job, NOW)

    content = stored_pdf_text(job.request_id)
    for label in (
        "Faturamento líquido",
        "Ticket médio",
        "Clientes ativos",
        "Clientes novos",
    ):
        assert f"{label}  não se aplica  não se aplica  não se aplica" in content
    assert f"Pedidos  {format_count(orders)}  " in content
    assert f"Março de 2026 · produto {product_name}" in content
