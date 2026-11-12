"""A conferência de somente leitura com o pglast (spec da F13, "Catálogo e consulta"; F13-T04, CA2)."""

from __future__ import annotations

from datetime import date
from zoneinfo import ZoneInfo

import pytest

from app.business.catalog import METRICS, Period, compiled_sql, query_for
from app.business.readonly import NotReadOnlyError, assert_read_only

MARCH = Period(date(2026, 3, 1), date(2026, 3, 31))


@pytest.mark.parametrize("metric", sorted(METRICS))
def test_aceita_o_sql_de_cada_metrica(metric: str) -> None:
    sql = compiled_sql(
        query_for(metric, MARCH, ZoneInfo("America/Sao_Paulo")).statement
    )

    assert_read_only(sql)


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO sellers (id, name) VALUES (1, 'x')",
        "UPDATE orders SET net_amount = 0",
        "DELETE FROM orders",
        "SELECT count(*) FROM orders; SELECT 1",
        "SELECT * INTO copia FROM orders",
        "SELECT * FROM orders FOR UPDATE",
        "WITH apagados AS (DELETE FROM orders RETURNING id) SELECT count(*) FROM apagados",
        "SELECT pg_sleep(10)",
        "SELECT sum(net_amount) FROM orders WHERE id IN (SELECT lo_import('/etc/passwd'))",
        "não é SQL",
    ],
)
def test_recusa_o_que_nao_e_um_select_so_de_leitura(sql: str) -> None:
    with pytest.raises(NotReadOnlyError):
        assert_read_only(sql)
