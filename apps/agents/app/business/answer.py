"""O texto da resposta, escrito pelo código (spec da F13, "Catálogo e consulta" e "O Agente
`assistente`").

Os números em pt-BR (moeda com R$ e duas casas, contagem inteira com separador de milhar) e a linha
do que foi considerado: a Métrica, os filtros, as datas e o fuso. O modelo não escreve número.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from app.business.catalog import Period
from app.business.lastro import numbers_in

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


# Os desfechos de nome (spec da F13, "O Agente `assistente`", passo 3 de `consultar_dados`).
PLURALS = {"cliente": "clientes", "vendedor": "vendedores", "produto": "produtos"}


def not_found_text(kind: str, name: str) -> str:
    return f"Não encontrei {kind} {name}."


def which_name_text(name: str) -> str:
    return f"Qual {name}?"


def too_generic_text(kind: str, name: str) -> str:
    return f"Há mais de cinco {PLURALS[kind]} com {name}. Diga um nome mais completo."


def unresolved_name_text(kind: str, name: str) -> str:
    return f"Não consegui identificar {kind} {name}. Mencione o Agente de novo com o nome completo."


@dataclass(frozen=True)
class Wording:
    """Como a Métrica sai no texto."""

    # O começo da frase e a preposição do período nela.
    title: str
    preposition: str
    # O começo da frase do resultado vazio.
    empty: str
    # O que foi considerado.
    considered: str
    # Moeda (R$ e duas casas) ou contagem inteira.
    money: bool = False


WORDING: dict[str, Wording] = {
    "faturamento": Wording(
        "Faturamento",
        "de",
        "Nenhum pedido pago",
        "faturamento líquido, pedidos pagos",
        True,
    ),
    "pedidos": Wording("Pedidos pagos", "em", "Nenhum pedido pago", "pedidos pagos"),
    "ticket_medio": Wording(
        "Ticket médio",
        "de",
        "Nenhum pedido pago",
        "faturamento líquido por pedido, pedidos pagos",
        True,
    ),
    "clientes_ativos": Wording(
        "Clientes ativos",
        "em",
        "Nenhum cliente ativo",
        "clientes distintos com pedido pago",
    ),
    "clientes_novos": Wording(
        "Clientes novos",
        "em",
        "Nenhum cliente novo",
        "clientes com conta criada no período",
    ),
    "itens_vendidos": Wording(
        "Itens vendidos",
        "em",
        "Nenhum item vendido",
        "unidades vendidas em pedidos pagos",
    ),
}
GROSS = Wording(
    "Faturamento bruto",
    "de",
    "Nenhum pedido pago",
    "faturamento bruto, pedidos pagos",
    True,
)


def wording(metric: str, *, gross: bool = False) -> Wording:
    return GROSS if metric == "faturamento" and gross else WORDING[metric]


CENTS = Decimal("0.01")


def rounded(metric: str, value: object) -> Decimal | int:
    """O valor como sai no texto: moeda com duas casas, contagem inteira."""
    if WORDING[metric].money:
        return Decimal(str(value)).quantize(CENTS, rounding=ROUND_HALF_UP)
    return int(value)  # type: ignore[call-overload]


def format_money(value: Decimal) -> str:
    return "R$ " + _thousands(value.quantize(CENTS, rounding=ROUND_HALF_UP), 2)


def format_count(value: int) -> str:
    return _thousands(Decimal(value), 0)


def _thousands(value: Decimal, places: int) -> str:
    text = f"{value:,.{places}f}"
    return text.replace(",", "\0").replace(".", ",").replace("\0", ".")


def _date(day: date) -> str:
    return day.strftime("%d/%m/%Y")


def _period_label(period: Period) -> tuple[str, Literal["named", "range", "day"]]:
    """O período pelo nome do mês ou do ano inteiro, senão pelas datas, e que tipo de rótulo é."""
    start, end = period.start, period.end
    next_day = end + timedelta(days=1)
    if (
        start.day == 1
        and next_day.day == 1
        and (start.year, start.month) == (end.year, end.month)
    ):
        return f"{MONTHS[start.month - 1]} de {start.year}", "named"
    if start == date(start.year, 1, 1) and end == date(start.year, 12, 31):
        return str(start.year), "named"
    if start == end:
        return _date(start), "day"
    return f"{_date(start)} a {_date(end)}", "range"


def period_label(period: Period) -> str:
    return _period_label(period)[0]


def period_span(period: Period, preposition: str) -> str:
    """O período na frase, com a preposição: "de março de 2026", "de 01/03/2026 a 15/03/2026"."""
    label, kind = _period_label(period)
    return {
        "named": f"{preposition} {label}",
        "day": f"em {label}",
        "range": f"de {label}",
    }[kind]


def format_value(metric: str, value: Decimal | int) -> str:
    return (
        format_money(Decimal(value))
        if WORDING[metric].money
        else format_count(int(value))
    )


def considered_line(
    metric: str,
    window: Period,
    time_zone: str,
    *,
    gross: bool = False,
    filter_label: str | None = None,
    compared: Period | None = None,
) -> str:
    considered = wording(metric, gross=gross).considered
    if filter_label:
        considered += f", {filter_label}"
    dates = f"de {_date(window.start)} a {_date(window.end)}"
    if compared:
        dates += f" contra {_date(compared.start)} a {_date(compared.end)}"
    return f"Considerado: {considered}, {dates}, fuso {time_zone}."


@dataclass(frozen=True)
class Comparison:
    """O período da comparação, a janela que ele lê e o valor dele (já arredondado)."""

    period: Period
    window: Period
    value: Decimal | int | None


TENTHS = Decimal("0.1")


def variation(current: Decimal | int, base: Decimal | int) -> Decimal | None:
    """`(atual - base) / base`, em percentual com uma casa; sem variação com a base zero."""
    if base == 0:
        return None
    change = (Decimal(current) - Decimal(base)) / Decimal(base) * 100
    return change.quantize(TENTHS, rounding=ROUND_HALF_UP)


def format_percent(value: Decimal) -> str:
    sign = "+" if value >= 0 else "-"
    return f"{sign}{_thousands(abs(value), 1)}%"


def comparable(metric: str, value: Decimal | int | None) -> Decimal | int | None:
    """Na comparação, um período vazio vale zero nas somas e contagens; o ticket médio fica vazio."""
    if value is None and metric != "ticket_medio":
        return 0
    return value


def comparison_numbers(
    metric: str, value: Decimal | int | None, comparison: Comparison
) -> tuple[Decimal | int | None, Decimal | int | None, Decimal | None]:
    """Os dois valores comparáveis e a variação, os mesmos no texto e no lastro."""
    current = comparable(metric, value)
    base = comparable(metric, comparison.value)
    change = None if current is None or base is None else variation(current, base)
    return current, base, change


def answer_text(
    metric: str,
    period: Period,
    window: Period,
    value: Decimal | int | None,
    time_zone: str,
    *,
    gross: bool = False,
    filter_label: str | None = None,
    comparison: Comparison | None = None,
) -> str:
    """A resposta da Métrica no período, ou a frase do resultado vazio, com a linha do que foi
    considerado; com a comparação, os dois valores e a variação. Os valores já vêm arredondados como
    saem no texto (`rounded`)."""
    words = wording(metric, gross=gross)
    title = f"{words.title} ({filter_label})" if filter_label else words.title
    span = period_span(period, words.preposition)
    if comparison is None:
        first = (
            f"{words.empty} {period_span(period, 'em')}."
            if value is None
            else f"{title} {span}: {format_value(metric, value)}."
        )
    else:
        current, base, change = comparison_numbers(metric, value, comparison)

        def shown(number: Decimal | int | None) -> str:
            return (
                "sem pedidos pagos" if number is None else format_value(metric, number)
            )

        first = (
            f"{title} {span}: {shown(current)}. "
            f"{period_label(comparison.period).capitalize()}: {shown(base)}. "
        )
        if change is not None:
            first += f"Variação: {format_percent(change)}."
        elif base == 0:
            first += "Sem variação percentual: a base é zero."
        else:
            first += "Sem variação percentual: um dos períodos não tem pedidos pagos."
    line = considered_line(
        metric,
        window,
        time_zone,
        gross=gross,
        filter_label=filter_label,
        compared=comparison.window if comparison else None,
    )
    return f"{first}\n\n{line}"


def allowed_numbers(
    values: Iterable[Decimal | int | None],
    period: Period,
    window: Period,
    time_zone: str,
) -> set[Decimal]:
    """O lastro da resposta: os valores do resultado, o dia, o mês e o ano das datas citadas e os
    números do nome do fuso (`Etc/GMT+3`), que a linha do que foi considerado cita."""
    allowed = {Decimal(value) for value in values if value is not None}
    allowed |= {abs(number) for number in numbers_in(time_zone)}
    for day in (period.start, period.end, window.start, window.end):
        allowed |= {Decimal(day.day), Decimal(day.month), Decimal(day.year)}
    return allowed
