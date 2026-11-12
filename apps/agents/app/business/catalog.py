"""O catálogo fixo de Métricas (spec da F13, "Catálogo e consulta"; ADR 0030).

O modelo escolhe a Métrica e o período; o SQL sai daqui, de SQLAlchemy Core com parâmetros ligados,
e nunca de texto da Conversa. Cada consulta devolve o valor (`value`) e a quantidade de linhas da
base (`base`): com a base vazia, o resultado é vazio, e o texto diz isso sem número.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal, get_args
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, Select, distinct, func, select
from sqlalchemy.dialects import postgresql

from app.business.schema import customers, order_items, orders

MetricName = Literal[
    "faturamento",
    "pedidos",
    "ticket_medio",
    "clientes_ativos",
    "clientes_novos",
    "itens_vendidos",
]
METRICS: frozenset[str] = frozenset(get_args(MetricName))

# "Clientes ativos": quem teve pedido pago nos últimos 90 dias até o fim do período.
ACTIVE_DAYS = 90
PAID = "paid"


@dataclass(frozen=True)
class Period:
    """Um período de datas inteiras, com o início e o fim inclusive, no fuso da empresa."""

    start: date
    end: date

    def bounds(self, time_zone: ZoneInfo) -> tuple[datetime, datetime]:
        """O intervalo `[início 00:00, fim + 1 dia 00:00)` no fuso da empresa, em UTC."""
        start = datetime.combine(self.start, time(), tzinfo=time_zone)
        end = datetime.combine(self.end + timedelta(days=1), time(), tzinfo=time_zone)
        return start.astimezone(UTC), end.astimezone(UTC)


@dataclass(frozen=True)
class Filter:
    """O cliente, o vendedor ou o produto a que a consulta se restringe, já resolvido pelo nome."""

    kind: str
    id: int


# Onde cada filtro vale (spec da F13, "O Agente `assistente`"; F13-T05).
FILTERABLE: dict[str, frozenset[str]] = {
    "vendedor": frozenset(
        {"faturamento", "pedidos", "ticket_medio", "clientes_ativos", "itens_vendidos"}
    ),
    "cliente": frozenset({"faturamento", "pedidos", "ticket_medio", "itens_vendidos"}),
    "produto": frozenset({"pedidos", "itens_vendidos"}),
}


@dataclass(frozen=True)
class Query:
    statement: Select
    # O período que a consulta lê: o pedido, ou a janela dos clientes ativos.
    window: Period


def query_for(
    metric: str,
    period: Period,
    time_zone: ZoneInfo,
    *,
    gross: bool = False,
    filter: Filter | None = None,
) -> Query:
    """A consulta da Métrica no período: o agregado da Métrica (`value`) e a contagem da base."""
    window = (
        Period(period.end - timedelta(days=ACTIVE_DAYS - 1), period.end)
        if metric == "clientes_ativos"
        else period
    )
    start, end = window.bounds(time_zone)
    if metric == "clientes_novos":
        return Query(
            statement=select(
                func.count().label("value"), func.count().label("base")
            ).where(customers.c.created_at >= start, customers.c.created_at < end),
            window=window,
        )
    amount = orders.c.gross_amount if gross else orders.c.net_amount
    value = {
        "faturamento": func.sum(amount),
        "pedidos": func.count(),
        "ticket_medio": func.avg(amount),
        "clientes_ativos": func.count(distinct(orders.c.customer_id)),
        "itens_vendidos": func.sum(order_items.c.quantity),
    }[metric]
    statement = select(value.label("value"), func.count().label("base")).where(
        orders.c.status == PAID, orders.c.ordered_at >= start, orders.c.ordered_at < end
    )
    if metric == "itens_vendidos":
        statement = statement.select_from(
            order_items.join(orders, order_items.c.order_id == orders.c.id)
        )
    if filter is not None:
        statement = statement.where(_filter_condition(metric, filter))
    return Query(statement=statement, window=window)


def _filter_condition(metric: str, filter: Filter) -> ColumnElement[bool]:
    if filter.kind == "vendedor":
        return orders.c.seller_id == filter.id
    if filter.kind == "cliente":
        return orders.c.customer_id == filter.id
    # Produto: as unidades dele, ou os pedidos pagos que o têm.
    if metric == "itens_vendidos":
        return order_items.c.product_id == filter.id
    return orders.c.id.in_(
        select(order_items.c.order_id).where(order_items.c.product_id == filter.id)
    )


def compiled_sql(statement: Select) -> str:
    """O SQL que o asyncpg recebe, com os parâmetros como `$n`: o que a conferência examina e a
    auditoria grava."""
    return str(statement.compile(dialect=postgresql.asyncpg.dialect()))
