"""A conferência do lastro (spec da F13, "Catálogo e consulta"; ADR 0014).

Extrai os números do texto final, no formato pt-BR, e confere que cada um está no conjunto dado: os
números do resultado e o dia, o mês e o ano das datas citadas. Um número sem lastro barra a resposta.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import date
from decimal import Decimal

# `1.234.567,89` (milhar com ponto e decimais com vírgula) ou um número simples, com sinal opcional.
NUMBER = re.compile(r"[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?")


def numbers_in(text: str) -> list[Decimal]:
    """Os números do texto, em ordem, normalizados do formato pt-BR."""
    return [
        Decimal(match.replace(".", "").replace(",", "."))
        for match in NUMBER.findall(text)
    ]


def has_lastro(text: str, allowed: Iterable[Decimal | int]) -> bool:
    """Todo número do texto (sem o sinal) está no conjunto permitido."""
    permitted = {abs(Decimal(number)) for number in allowed}
    return all(abs(number) in permitted for number in numbers_in(text))


def date_numbers(*days: date) -> set[Decimal]:
    """O dia, o mês e o ano de cada data citada no texto."""
    return {Decimal(part) for day in days for part in (day.day, day.month, day.year)}
