"""A busca de cliente, vendedor ou produto por trecho do nome (spec da F13, "Catálogo e consulta",
`names.py`).

Sem diferença de maiúsculas nem acentos, pela normalização em Python sobre a lista de nomes da
tabela, que é pequena, sem depender da extensão `unaccent` no Banco de negócio.
"""

from __future__ import annotations

import unicodedata

from sqlalchemy import Table, select

from app.business.db import BusinessStore
from app.business.schema import customers, products, sellers

TABLES: dict[str, Table] = {
    "cliente": customers,
    "vendedor": sellers,
    "produto": products,
}


def normalized(text: str) -> str:
    """Sem acentos, sem diferença de maiúsculas e com os espaços colapsados."""
    without_marks = "".join(
        char
        for char in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(char)
    )
    return " ".join(without_marks.casefold().split())


def matching(rows: list[tuple[int, str]], query: str) -> list[tuple[int, str]]:
    """Os nomes que contêm o trecho, na ordem do id; um nome igual ao procurado vence os trechos."""
    wanted = normalized(query)
    if not wanted:
        return []
    keyed = [(row, normalized(row[1])) for row in rows]
    exact = [row for row, key in keyed if key == wanted]
    return exact or [row for row, key in keyed if wanted in key]


async def find(store: BusinessStore, kind: str, name: str) -> list[tuple[int, str]]:
    """Os cadastros do tipo cujo nome tem o trecho, pelo usuário só leitura."""
    table = TABLES[kind]
    async with store.business.connect() as connection:
        result = await connection.execute(
            select(table.c.id, table.c.name).order_by(table.c.id)
        )
        return matching([(row.id, row.name) for row in result], name)
