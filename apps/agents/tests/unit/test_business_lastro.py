"""A conferência do lastro (spec da F13, "Catálogo e consulta"; ADR 0014; F13-T04, CA4)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.business.answer import allowed_numbers, answer_text
from app.business.catalog import Period
from app.business.lastro import has_lastro, numbers_in

MARCH = Period(date(2026, 3, 1), date(2026, 3, 31))


def test_le_os_numeros_em_pt_br() -> None:
    assert numbers_in("R$ 1.234.567,89 em 01/03/2026, +12,2% e 271") == [
        Decimal("1234567.89"),
        Decimal("1"),
        Decimal("3"),
        Decimal("2026"),
        Decimal("12.2"),
        Decimal("271"),
    ]


def test_aceita_o_texto_da_resposta() -> None:
    value = Decimal("1234567.89")
    text = answer_text("faturamento", MARCH, MARCH, value)

    assert has_lastro(text, allowed_numbers([value], MARCH, MARCH))


def test_recusa_um_numero_sem_lastro() -> None:
    value = Decimal("1234567.89")
    text = (
        answer_text("faturamento", MARCH, MARCH, value)
        + " Em fevereiro foi R$ 1.100.000,00."
    )

    assert not has_lastro(text, allowed_numbers([value], MARCH, MARCH))
