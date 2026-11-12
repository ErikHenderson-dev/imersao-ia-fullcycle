"""O período anterior do Relatório (spec da F14, "Período anterior"; F14-T04, CA1)."""

from datetime import date

import pytest

from app.business.catalog import Period
from app.business.periods import report_periods

TODAY = date(2026, 11, 12)


def p(start: str, end: str) -> Period:
    return Period(date.fromisoformat(start), date.fromisoformat(end))


@pytest.mark.parametrize(
    ("asked", "today", "period", "previous"),
    [
        # Mês inteiro contra o mês anterior inteiro.
        (
            p("2026-03-01", "2026-03-31"),
            TODAY,
            p("2026-03-01", "2026-03-31"),
            p("2026-02-01", "2026-02-28"),
        ),
        # Trimestre inteiro contra o anterior, na virada do ano.
        (
            p("2026-01-01", "2026-03-31"),
            TODAY,
            p("2026-01-01", "2026-03-31"),
            p("2025-10-01", "2025-12-31"),
        ),
        # Ano inteiro contra o anterior.
        (
            p("2025-01-01", "2025-12-31"),
            TODAY,
            p("2025-01-01", "2025-12-31"),
            p("2024-01-01", "2024-12-31"),
        ),
        # Intervalo contra os mesmos dias antes dele.
        (
            p("2026-03-10", "2026-03-19"),
            TODAY,
            p("2026-03-10", "2026-03-19"),
            p("2026-02-28", "2026-03-09"),
        ),
        # Mês em andamento contra o mesmo trecho do mês anterior.
        (
            p("2026-11-01", "2026-11-12"),
            TODAY,
            p("2026-11-01", "2026-11-12"),
            p("2026-10-01", "2026-10-12"),
        ),
        # O fim depois de hoje é cortado em hoje.
        (
            p("2026-11-01", "2026-11-30"),
            TODAY,
            p("2026-11-01", "2026-11-12"),
            p("2026-10-01", "2026-10-12"),
        ),
        # Em andamento num mês mais longo que o anterior: cortado no último dia do anterior.
        (
            p("2026-03-01", "2026-03-31"),
            date(2026, 3, 31),
            p("2026-03-01", "2026-03-31"),
            p("2026-02-01", "2026-02-28"),
        ),
        (
            p("2025-03-01", "2025-03-30"),
            date(2025, 3, 30),
            p("2025-03-01", "2025-03-30"),
            p("2025-02-01", "2025-02-28"),
        ),
        # Janeiro contra dezembro do ano anterior.
        (
            p("2026-01-01", "2026-01-31"),
            TODAY,
            p("2026-01-01", "2026-01-31"),
            p("2025-12-01", "2025-12-31"),
        ),
        # Bissexto: março de 2024 contra fevereiro de 29 dias.
        (
            p("2024-03-01", "2024-03-31"),
            TODAY,
            p("2024-03-01", "2024-03-31"),
            p("2024-02-01", "2024-02-29"),
        ),
        # Ano em andamento contra o mesmo trecho do ano anterior.
        (
            p("2026-01-01", "2026-11-12"),
            TODAY,
            p("2026-01-01", "2026-11-12"),
            p("2025-01-01", "2025-11-12"),
        ),
        # Um dia só contra o dia anterior.
        (
            p("2026-03-10", "2026-03-10"),
            TODAY,
            p("2026-03-10", "2026-03-10"),
            p("2026-03-09", "2026-03-09"),
        ),
    ],
)
def test_o_periodo_anterior(
    asked: Period, today: date, period: Period, previous: Period
) -> None:
    assert report_periods(asked.start, asked.end, today) == (period, previous)
