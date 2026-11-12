"""O catálogo de Métricas (spec da F13, "Catálogo e consulta"; F13-T04, CA1)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest

from app.business.catalog import METRICS, Period, compiled_sql, query_for

TZ = ZoneInfo("America/Sao_Paulo")
MARCH = Period(date(2026, 3, 1), date(2026, 3, 31))


@pytest.mark.parametrize("metric", sorted(METRICS))
def test_o_sql_de_cada_metrica_nao_tem_coluna_de_contato_nem_valor_literal(
    metric: str,
) -> None:
    sql = compiled_sql(query_for(metric, MARCH, TZ).statement)

    assert sql.lstrip().upper().startswith("SELECT")
    for contact in ["email", "phone", "document"]:
        assert contact not in sql
    for literal in ["paid", "2026", "'"]:
        assert literal not in sql
    assert "$1" in sql


def test_o_bruto_troca_a_coluna_do_faturamento() -> None:
    net = compiled_sql(query_for("faturamento", MARCH, TZ).statement)
    gross = compiled_sql(query_for("faturamento", MARCH, TZ, gross=True).statement)

    assert "net_amount" in net and "gross_amount" not in net
    assert "gross_amount" in gross and "net_amount" not in gross


def test_o_periodo_vira_o_intervalo_em_utc_no_fuso_da_empresa() -> None:
    start, end = MARCH.bounds(TZ)

    assert start == datetime(2026, 3, 1, 3, tzinfo=UTC)
    assert end == datetime(2026, 4, 1, 3, tzinfo=UTC)


def test_clientes_ativos_olham_os_90_dias_ate_o_fim_do_periodo() -> None:
    query = query_for("clientes_ativos", MARCH, TZ)

    assert query.window == Period(date(2026, 1, 1), date(2026, 3, 31))
