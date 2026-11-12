"""O período do Relatório e o período anterior (spec da F14, "Período anterior").

Função pura: o modelo escolhe o período, e o código decide com que período compará-lo. Um mês, um
trimestre ou um ano inteiros comparam com o anterior inteiro; em andamento, com o mesmo número de
dias a partir do início do anterior, cortado no último dia dele; qualquer outro intervalo, com os
mesmos dias antes dele. O fim depois de hoje é cortado em hoje. Tudo em datas do fuso da empresa.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta

from app.business.catalog import Period


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _quarter_start(day: date) -> date:
    return date(day.year, (day.month - 1) // 3 * 3 + 1, 1)


def _year_start(day: date) -> date:
    return date(day.year, 1, 1)


def _add_months(day: date, months: int) -> date:
    index = day.year * 12 + day.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


# Cada unidade: o início dela para um dia e quantos meses ela tem.
UNITS: tuple[tuple[Callable[[date], date], int], ...] = (
    (_month_start, 1),
    (_quarter_start, 3),
    (_year_start, 12),
)


def report_periods(start: date, end: date, today: date) -> tuple[Period, Period]:
    """O período (com o fim cortado em hoje) e o período anterior com que ele é comparado."""
    in_progress = end >= today
    period = Period(start, min(end, today))
    days = (period.end - period.start).days + 1
    for unit_start, months in UNITS:
        if unit_start(start) != start:
            continue
        unit_end = _add_months(start, months) - timedelta(days=1)
        # Inteira só se nada foi cortado; pedida até o fim, mas em andamento, conta como em andamento.
        whole = period.end == unit_end
        if not (whole or (in_progress and end <= unit_end)):
            continue
        previous_start = _add_months(start, -months)
        previous_end = start - timedelta(days=1)
        if not whole:
            previous_end = min(previous_start + timedelta(days=days - 1), previous_end)
        return period, Period(previous_start, previous_end)
    return period, Period(start - timedelta(days=days), start - timedelta(days=1))
