"""O texto da resposta (spec da F13, "Catálogo e consulta" e "O Agente `assistente`"; F13-T04, CA4)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.business.answer import answer_text, format_count, format_money
from app.business.catalog import Period

TZ = "America/Sao_Paulo"

MARCH = Period(date(2026, 3, 1), date(2026, 3, 31))
CONSIDERADO = "de 01/03/2026 a 31/03/2026, fuso America/Sao_Paulo."


def test_formata_moeda_e_contagem_em_pt_br() -> None:
    assert format_money(Decimal("1234567.89")) == "R$ 1.234.567,89"
    assert format_money(Decimal("59.9")) == "R$ 59,90"
    assert format_count(12345) == "12.345"


@pytest.mark.parametrize(
    ("metric", "value", "gross", "expected"),
    [
        (
            "faturamento",
            Decimal("1234567.89"),
            False,
            "Faturamento de março de 2026: R$ 1.234.567,89.\n\n"
            f"Considerado: faturamento líquido, pedidos pagos, {CONSIDERADO}",
        ),
        (
            "faturamento",
            Decimal("1300000.00"),
            True,
            "Faturamento bruto de março de 2026: R$ 1.300.000,00.\n\n"
            f"Considerado: faturamento bruto, pedidos pagos, {CONSIDERADO}",
        ),
        (
            "pedidos",
            271,
            False,
            f"Pedidos pagos em março de 2026: 271.\n\nConsiderado: pedidos pagos, {CONSIDERADO}",
        ),
        (
            "ticket_medio",
            Decimal("945.10"),
            False,
            "Ticket médio de março de 2026: R$ 945,10.\n\n"
            f"Considerado: faturamento líquido por pedido, pedidos pagos, {CONSIDERADO}",
        ),
        (
            "clientes_novos",
            14,
            False,
            "Clientes novos em março de 2026: 14.\n\n"
            f"Considerado: clientes com conta criada no período, {CONSIDERADO}",
        ),
        (
            "itens_vendidos",
            1500,
            False,
            "Itens vendidos em março de 2026: 1.500.\n\n"
            f"Considerado: unidades vendidas em pedidos pagos, {CONSIDERADO}",
        ),
    ],
)
def test_a_resposta_tem_o_numero_em_pt_br_e_a_linha_do_que_foi_considerado(
    metric: str, value: Decimal | int, gross: bool, expected: str
) -> None:
    assert answer_text(metric, MARCH, MARCH, value, TZ, gross=gross) == expected


def test_clientes_ativos_mostram_a_janela_na_linha() -> None:
    window = Period(date(2026, 1, 1), date(2026, 3, 31))

    text = answer_text("clientes_ativos", MARCH, window, 180, TZ)

    assert text == (
        "Clientes ativos em março de 2026: 180.\n\n"
        "Considerado: clientes distintos com pedido pago, de 01/01/2026 a 31/03/2026, "
        "fuso America/Sao_Paulo."
    )


def test_o_resultado_vazio_e_dito_como_tal() -> None:
    text = answer_text("pedidos", MARCH, MARCH, None, TZ)

    assert text.startswith("Nenhum pedido pago em março de 2026.")


def test_o_periodo_que_nao_e_um_mes_vai_com_as_datas() -> None:
    period = Period(date(2026, 3, 1), date(2026, 3, 15))

    text = answer_text("pedidos", period, period, 120, TZ)

    assert text.startswith("Pedidos pagos de 01/03/2026 a 15/03/2026: 120.")
