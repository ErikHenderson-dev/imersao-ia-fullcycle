"""O texto da resposta, escrito pelo código (spec da F13, "Catálogo e consulta" e "O Agente
`assistente`").

Os números em pt-BR (moeda com R$ e duas casas, contagem inteira com separador de milhar) e a linha
do que foi considerado: a Métrica, os filtros, as datas e o fuso. O modelo não escreve número.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from app.business.catalog import Period
from app.config import DEFAULT_BUSINESS_TIME_ZONE

TIME_ZONE_NAME = DEFAULT_BUSINESS_TIME_ZONE
NAO_CONSEGUI_RESPONDER = "Não consegui responder."
SEM_PERMISSAO = "Você não tem acesso a dados de negócio. Peça a permissão a quem opera a instalação."

MONTHS = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
]
MONEY_METRICS = frozenset({"faturamento", "ticket_medio"})

# Por Métrica: o começo da frase (com a preposição do período), o começo da frase vazia e o que foi
# considerado.
TEMPLATES: dict[str, tuple[str, str, str]] = {
    "faturamento": (
        "Faturamento",
        "Nenhum pedido pago",
        "faturamento líquido, pedidos pagos",
    ),
    "pedidos": ("Pedidos pagos", "Nenhum pedido pago", "pedidos pagos"),
    "ticket_medio": (
        "Ticket médio",
        "Nenhum pedido pago",
        "faturamento líquido por pedido, pedidos pagos",
    ),
    "clientes_ativos": (
        "Clientes ativos",
        "Nenhum cliente ativo",
        "clientes distintos com pedido pago",
    ),
    "clientes_novos": (
        "Clientes novos",
        "Nenhum cliente novo",
        "clientes com conta criada no período",
    ),
    "itens_vendidos": (
        "Itens vendidos",
        "Nenhum item vendido",
        "unidades vendidas em pedidos pagos",
    ),
}
# A preposição do período no título (sempre "em" na frase vazia).
PREPOSITIONS = {"faturamento": "de", "ticket_medio": "de"}

CENTS = Decimal("0.01")


def format_money(value: Decimal) -> str:
    return "R$ " + _thousands(value.quantize(CENTS, rounding=ROUND_HALF_UP), 2)


def format_count(value: int) -> str:
    return _thousands(Decimal(value), 0)


def _thousands(value: Decimal, places: int) -> str:
    text = f"{value:,.{places}f}"
    return text.replace(",", "\0").replace(".", ",").replace("\0", ".")


def _date(day: date) -> str:
    return day.strftime("%d/%m/%Y")


def period_span(period: Period, preposition: str) -> str:
    """O período na frase: o mês ou o ano inteiro pelo nome, senão as datas."""
    start, end = period.start, period.end
    next_day = end + timedelta(days=1)
    if (
        start.day == 1
        and next_day.day == 1
        and (start.year, start.month) == (end.year, end.month)
    ):
        return f"{preposition} {MONTHS[start.month - 1]} de {start.year}"
    if (start.month, start.day, end.month, end.day) == (
        1,
        1,
        12,
        31,
    ) and start.year == end.year:
        return f"{preposition} {start.year}"
    if start == end:
        return f"em {_date(start)}"
    return f"de {_date(start)} a {_date(end)}"


def format_value(metric: str, value: Decimal | int) -> str:
    return (
        format_money(Decimal(value))
        if metric in MONEY_METRICS
        else format_count(int(value))
    )


def considered_line(metric: str, window: Period, *, gross: bool = False) -> str:
    considered = TEMPLATES[metric][2]
    if metric == "faturamento" and gross:
        considered = "faturamento bruto, pedidos pagos"
    return (
        f"Considerado: {considered}, de {_date(window.start)} a {_date(window.end)}, "
        f"fuso {TIME_ZONE_NAME}."
    )


def answer_text(
    metric: str,
    period: Period,
    window: Period,
    value: Decimal | int | None,
    *,
    gross: bool = False,
) -> str:
    """A resposta da Métrica no período, ou a frase do resultado vazio, com a linha do que foi
    considerado. O valor já vem arredondado como sai no texto."""
    title, empty, _ = TEMPLATES[metric]
    if value is None:
        first = f"{empty} {period_span(period, 'em')}."
    else:
        if metric == "faturamento" and gross:
            title = "Faturamento bruto"
        span = period_span(period, PREPOSITIONS.get(metric, "em"))
        first = f"{title} {span}: {format_value(metric, value)}."
    return f"{first}\n\n{considered_line(metric, window, gross=gross)}"


def allowed_numbers(
    values: Iterable[Decimal | int | None], period: Period, window: Period
) -> set[Decimal]:
    """O lastro da resposta: os valores do resultado e o dia, o mês e o ano das datas citadas."""
    allowed = {Decimal(value) for value in values if value is not None}
    for day in (period.start, period.end, window.start, window.end):
        allowed |= {Decimal(day.day), Decimal(day.month), Decimal(day.year)}
    return allowed
