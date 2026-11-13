"""A consulta das seis Métricas e as linhas da tabela do Relatório (F14-T03, CA3)."""

from datetime import date
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.business.catalog import Filter, Period, compiled_sql
from app.business.readonly import assert_read_only
from app.worker.metrics import (
    NO_PAID_ORDERS,
    NO_VARIATION,
    NOT_APPLICABLE,
    applicable_metrics,
    metrics_query,
    report_rows,
)

MARCH = Period(date(2026, 3, 1), date(2026, 3, 31))
TZ = ZoneInfo("America/Sao_Paulo")


def _columns(sql: str) -> str:
    return sql.split("FROM", 1)[0]


def test_a_consulta_das_seis_metricas_e_um_select_so_de_leitura() -> None:
    sql = compiled_sql(metrics_query(MARCH, TZ, None))

    assert_read_only(sql)
    for metric in (
        "faturamento",
        "pedidos",
        "ticket_medio",
        "clientes_ativos",
        "clientes_novos",
        "itens_vendidos",
    ):
        assert f"{metric}_value" in _columns(sql)


def test_o_filtro_de_vendedor_deixa_clientes_novos_de_fora() -> None:
    sql = compiled_sql(metrics_query(MARCH, TZ, Filter("vendedor", 3)))

    assert_read_only(sql)
    assert "clientes_novos_value" not in _columns(sql)
    assert applicable_metrics(Filter("vendedor", 3)) == [
        "faturamento",
        "pedidos",
        "ticket_medio",
        "clientes_ativos",
        "itens_vendidos",
    ]


def test_o_filtro_de_produto_so_vale_para_pedidos_e_itens_vendidos() -> None:
    assert applicable_metrics(Filter("produto", 9)) == ["pedidos", "itens_vendidos"]


def test_as_linhas_seguem_a_variacao_da_f13() -> None:
    current = {
        "faturamento": Decimal("110.00"),
        "pedidos": 4,
        "ticket_medio": None,
        "clientes_ativos": 2,
        "clientes_novos": None,
        "itens_vendidos": 10,
    }
    previous = {
        "faturamento": Decimal("100.00"),
        "pedidos": None,
        "ticket_medio": Decimal("50.00"),
        "clientes_ativos": 2,
        "clientes_novos": 1,
        "itens_vendidos": 8,
    }

    rows = {row.label: row for row in report_rows(current, previous, None)}

    assert (
        rows["Faturamento líquido"].current,
        rows["Faturamento líquido"].change,
    ) == (
        "R$ 110,00",
        "+10,0%",
    )
    # O período anterior sem pedidos pagos vale zero: base zero, sem variação.
    assert (rows["Pedidos"].previous, rows["Pedidos"].change) == ("0", NO_VARIATION)
    # Sem pedidos pagos, o Ticket médio fica vazio.
    assert (rows["Ticket médio"].current, rows["Ticket médio"].change) == (
        NO_PAID_ORDERS,
        NO_VARIATION,
    )
    assert rows["Clientes novos"].current == "0"
    assert rows["Itens vendidos"].change == "+25,0%"


def test_a_metrica_fora_do_filtro_nao_se_aplica() -> None:
    values = {"pedidos": 3, "itens_vendidos": 5}

    rows = report_rows(values, values, Filter("produto", 9))

    faturamento = rows[0]
    assert (faturamento.current, faturamento.previous, faturamento.change) == (
        NOT_APPLICABLE,
        NOT_APPLICABLE,
        NOT_APPLICABLE,
    )
    assert faturamento.numbers == ()
