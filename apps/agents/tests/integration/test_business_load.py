"""O Banco de negócio com dados fixos (spec da F13, "Banco de negócio e script de carga"; F13-T03).

O `business_test` é recriado uma vez por execução pelo superusuário, com os papéis do init, e a
carga roda como o dono (`SET ROLE business`). O usuário só leitura conecta por
`BUSINESS_TEST_DATABASE_URL`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime
from zoneinfo import ZoneInfo

import asyncpg
import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

from app.business.load import load

pytestmark = pytest.mark.asyncio(loop_scope="session")

TABLES = ["customers", "sellers", "products", "orders", "order_items"]
TZ = ZoneInfo("America/Sao_Paulo")


@pytest_asyncio.fixture
async def owner(business_test_admin_url: str) -> AsyncIterator[AsyncConnection]:
    """Uma conexão do superusuário no `business_test`, agindo como o dono."""
    engine = create_async_engine(business_test_admin_url)
    async with engine.connect() as connection:
        await connection.execute(text("SET ROLE business"))
        await connection.commit()
        yield connection
    await engine.dispose()


def plain(url: str) -> str:
    """A URL do SQLAlchemy no formato do asyncpg."""
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def loaded(owner: AsyncConnection) -> None:
    async with owner.begin():
        await load(owner)


async def summary(owner: AsyncConnection) -> dict[str, object]:
    """A contagem de cada tabela e uma soma de controle das linhas, na ordem do id."""
    out: dict[str, object] = {}
    for table in TABLES:
        row = (
            await owner.execute(
                text(
                    f"SELECT count(*), md5(string_agg(t::text, '|' ORDER BY t.id)) FROM {table} t"
                )
            )
        ).one()
        out[table] = tuple(row)
    # Só leitura: encerra a transação que a leitura abriu, para a carga seguinte abrir a dela.
    await owner.rollback()
    return out


async def test_cria_as_tabelas_e_os_indices_da_spec(owner: AsyncConnection) -> None:
    await loaded(owner)

    columns = (
        await owner.execute(
            text(
                "SELECT table_name, string_agg(column_name, ',' ORDER BY ordinal_position) "
                "FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name"
            )
        )
    ).all()
    indexes = (
        await owner.execute(
            text("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public'")
        )
    ).scalars()

    assert dict(columns) == {
        "customers": "id,name,email,phone,document,created_at",
        "sellers": "id,name",
        "products": "id,name,price",
        "orders": "id,customer_id,seller_id,ordered_at,status,gross_amount,discount,net_amount",
        "order_items": "id,order_id,product_id,quantity,unit_price",
    }
    definitions = " ".join(indexes)
    for expected in [
        "orders USING btree (status, ordered_at)",
        "orders USING btree (seller_id)",
        "orders USING btree (customer_id)",
        "order_items USING btree (order_id)",
    ]:
        assert expected in definitions


async def test_a_carga_que_falha_no_meio_nao_deixa_nada(owner: AsyncConnection) -> None:
    await loaded(owner)
    before = await summary(owner)

    with pytest.raises(RuntimeError):
        async with owner.begin():
            await load(owner)
            raise RuntimeError("falha no meio")

    assert await summary(owner) == before


async def test_rodar_duas_vezes_da_os_mesmos_dados(owner: AsyncConnection) -> None:
    await loaded(owner)
    first = await summary(owner)

    await loaded(owner)

    assert await summary(owner) == first


async def test_os_pedidos_cobrem_o_periodo_e_os_tres_status(
    owner: AsyncConnection,
) -> None:
    await loaded(owner)

    first, last = (
        await owner.execute(text("SELECT min(ordered_at), max(ordered_at) FROM orders"))
    ).one()
    statuses = set(
        (await owner.execute(text("SELECT DISTINCT status FROM orders"))).scalars()
    )

    assert first.astimezone(TZ).date().isoformat() == "2025-01-01"
    assert last.astimezone(TZ).date().isoformat() == "2026-10-31"
    assert statuses == {"paid", "cancelled", "pending"}


async def test_os_dados_trazem_os_nomes_repetidos_e_o_mes_sem_pedidos(
    owner: AsyncConnection,
) -> None:
    await loaded(owner)

    anas = (
        await owner.execute(
            text("SELECT count(*) FROM sellers WHERE name ILIKE '%ana%'")
        )
    ).scalar_one()
    silvas = (
        await owner.execute(
            text("SELECT count(*) FROM customers WHERE name ILIKE '%silva%'")
        )
    ).scalar_one()

    async def orders_of_ana_paula(year: int, month: int) -> int:
        start = datetime(year, month, 1, tzinfo=TZ)
        end = datetime(year + month // 12, month % 12 + 1, 1, tzinfo=TZ)
        return (
            await owner.execute(
                text(
                    "SELECT count(*) FROM orders o JOIN sellers s ON s.id = o.seller_id "
                    "WHERE s.name = 'Ana Paula Ramos' AND o.ordered_at >= :start "
                    "AND o.ordered_at < :end"
                ),
                {"start": start, "end": end},
            )
        ).scalar_one()

    assert anas == 2
    assert silvas == 6
    assert await orders_of_ana_paula(2026, 7) == 0
    assert await orders_of_ana_paula(2026, 6) > 0
    assert await orders_of_ana_paula(2026, 8) > 0


async def test_o_usuario_so_leitura_le_as_tabelas(
    owner: AsyncConnection, business_test_database_url: str
) -> None:
    await loaded(owner)
    readonly = await asyncpg.connect(plain(business_test_database_url))

    try:
        counts = [await readonly.fetchval(f"SELECT count(*) FROM {t}") for t in TABLES]
    finally:
        await readonly.close()

    assert all(count > 0 for count in counts)


@pytest.mark.parametrize(
    "statement",
    [
        "INSERT INTO sellers (id, name) VALUES (999, 'Intrusa')",
        "UPDATE orders SET net_amount = 0",
        "DELETE FROM order_items",
        "CREATE TABLE intrusa (id int)",
    ],
)
async def test_o_usuario_so_leitura_nao_escreve(
    owner: AsyncConnection, business_test_database_url: str, statement: str
) -> None:
    await loaded(owner)
    readonly = await asyncpg.connect(plain(business_test_database_url))

    try:
        with pytest.raises(asyncpg.InsufficientPrivilegeError):
            await readonly.execute(statement)
    finally:
        await readonly.close()
