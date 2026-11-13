"""As seis Métricas do Relatório num período e as linhas da tabela (spec da F14, "Worker de agentes").

Uma consulta por período, montada a partir do catálogo da F13: uma subconsulta agregada por Métrica
que se aplica ao filtro, unidas numa linha só. A Métrica em que o filtro não faz sentido fica fora
da consulta, e a linha dela mostra "não se aplica". As variações seguem a F13.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import Select, select, true

from app.business.answer import (
    comparable,
    format_percent,
    format_value,
    rounded,
    variation,
)
from app.business.catalog import FILTERABLE, Filter, Period, query_for

# As Métricas na ordem do catálogo, com o rótulo da tabela.
REPORT_METRICS: tuple[tuple[str, str], ...] = (
    ("faturamento", "Faturamento líquido"),
    ("pedidos", "Pedidos"),
    ("ticket_medio", "Ticket médio"),
    ("clientes_ativos", "Clientes ativos"),
    ("clientes_novos", "Clientes novos"),
    ("itens_vendidos", "Itens vendidos"),
)

NOT_APPLICABLE = "não se aplica"
NO_PAID_ORDERS = "sem pedidos pagos"
NO_VARIATION = "sem variação percentual"

Value = Decimal | int | None


def applicable_metrics(filter: Filter | None) -> list[str]:
    """As Métricas em que o filtro se aplica, na ordem do catálogo; todas sem filtro."""
    return [
        metric
        for metric, _ in REPORT_METRICS
        if filter is None or metric in FILTERABLE[filter.kind]
    ]


def metrics_query(period: Period, time_zone: ZoneInfo, filter: Filter | None) -> Select:
    """Um SELECT com `<métrica>_value` e `<métrica>_base` de cada Métrica que se aplica."""
    subqueries = [
        query_for(metric, period, time_zone, filter=filter).statement.subquery(metric)
        for metric in applicable_metrics(filter)
    ]
    columns = [
        column
        for subquery in subqueries
        for column in (
            subquery.c.value.label(f"{subquery.name}_value"),
            subquery.c.base.label(f"{subquery.name}_base"),
        )
    ]
    joined = subqueries[0]
    for subquery in subqueries[1:]:
        joined = joined.join(subquery, true())
    return select(*columns).select_from(joined)


def values_of(row: Any, filter: Filter | None) -> dict[str, Value]:
    """O valor de cada Métrica que se aplica, arredondado como sai no texto, ou nenhum com a base
    vazia."""
    values: dict[str, Value] = {}
    for metric in applicable_metrics(filter):
        value = getattr(row, f"{metric}_value")
        base = getattr(row, f"{metric}_base")
        values[metric] = None if base == 0 or value is None else rounded(metric, value)
    return values


@dataclass(frozen=True)
class MetricRow:
    """Uma linha da tabela: o rótulo e os três textos, e os números que ela mostra (o lastro)."""

    label: str
    current: str
    previous: str
    change: str
    numbers: tuple[Decimal, ...]


def report_rows(
    current: dict[str, Value], previous: dict[str, Value], filter: Filter | None
) -> list[MetricRow]:
    """As seis linhas na ordem do catálogo: os valores comparáveis da F13 (um período vazio vale
    zero nas somas e contagens; o Ticket médio fica sem pedidos pagos) e a variação."""
    applicable = set(applicable_metrics(filter))
    rows = []
    for metric, label in REPORT_METRICS:
        if metric not in applicable:
            rows.append(
                MetricRow(label, NOT_APPLICABLE, NOT_APPLICABLE, NOT_APPLICABLE, ())
            )
            continue
        now = comparable(metric, current[metric])
        before = comparable(metric, previous[metric])
        change = None if now is None or before is None else variation(now, before)
        numbers = tuple(Decimal(n) for n in (now, before, change) if n is not None)
        rows.append(
            MetricRow(
                label,
                _shown(metric, now),
                _shown(metric, before),
                NO_VARIATION if change is None else format_percent(change),
                numbers,
            )
        )
    return rows


def _shown(metric: str, value: Value) -> str:
    return NO_PAID_ORDERS if value is None else format_value(metric, value)
