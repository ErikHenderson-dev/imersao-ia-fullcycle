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

from sqlalchemy import Select, distinct, func, select
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
class Query:
    statement: Select
    # O período que a consulta lê: o pedido, ou a janela dos clientes ativos.
    window: Period


def query_for(
    metric: str, period: Period, time_zone: ZoneInfo, *, gross: bool = False
) -> Query:
    """A consulta da Métrica no período."""
    window = (
        Period(period.end - timedelta(days=ACTIVE_DAYS - 1), period.end)
        if metric == "clientes_ativos"
        else period
    )
    start, end = window.bounds(time_zone)
    paid_in_window = (
        orders.c.status == PAID,
        orders.c.ordered_at >= start,
        orders.c.ordered_at < end,
    )
    amount = orders.c.gross_amount if gross else orders.c.net_amount
    count = func.count().label("base")
    statements: dict[str, Select] = {
        "faturamento": select(func.sum(amount).label("value"), count).where(
            *paid_in_window
        ),
        "pedidos": select(func.count().label("value"), count).where(*paid_in_window),
        "ticket_medio": select(func.avg(amount).label("value"), count).where(
            *paid_in_window
        ),
        "clientes_ativos": select(
            func.count(distinct(orders.c.customer_id)).label("value"), count
        ).where(*paid_in_window),
        "clientes_novos": select(func.count().label("value"), count).where(
            customers.c.created_at >= start, customers.c.created_at < end
        ),
        "itens_vendidos": select(func.sum(order_items.c.quantity).label("value"), count)
        .select_from(order_items.join(orders, order_items.c.order_id == orders.c.id))
        .where(*paid_in_window),
    }
    return Query(statement=statements[metric], window=window)


def compiled_sql(statement: Select) -> str:
    """O SQL que o asyncpg recebe, com os parâmetros como `$n`: o que a conferência examina e a
    auditoria grava."""
    return str(statement.compile(dialect=postgresql.asyncpg.dialect()))
