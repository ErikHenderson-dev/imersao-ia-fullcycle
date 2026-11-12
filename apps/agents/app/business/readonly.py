"""A conferência de somente leitura (spec da F13, "Catálogo e consulta"; ADR 0013).

Com o pglast, o parser do próprio Postgres: o SQL precisa ser um único `SELECT`, sem `INTO`, sem
trava e sem chamada de função fora da lista permitida, nem instrução que altere dados em lugar
nenhum (uma CTE com `DELETE`, por exemplo). É a segunda barreira: a primeira é o usuário só leitura.
"""

from __future__ import annotations

from collections.abc import Iterator

from pglast import ast, parse_sql
from pglast.parser import ParseError

ALLOWED_FUNCTIONS = frozenset({"sum", "count", "avg", "coalesce"})
WRITES = (ast.InsertStmt, ast.UpdateStmt, ast.DeleteStmt, ast.MergeStmt)


class NotReadOnlyError(Exception):
    """O SQL não é um único SELECT só de leitura."""


def _nodes(value: object) -> Iterator[ast.Node]:
    """Todos os nós da árvore, em profundidade."""
    if isinstance(value, ast.Node):
        yield value
        for attribute in value:
            yield from _nodes(getattr(value, attribute))
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from _nodes(item)


def _check(node: ast.Node) -> None:
    if isinstance(node, WRITES):
        raise NotReadOnlyError(type(node).__name__)
    if isinstance(node, ast.SelectStmt) and (node.intoClause or node.lockingClause):
        raise NotReadOnlyError("SELECT com INTO ou trava")
    if isinstance(node, ast.FuncCall):
        name = node.funcname[-1].sval.lower()
        if name not in ALLOWED_FUNCTIONS:
            raise NotReadOnlyError(f"função {name}")


def assert_read_only(sql: str) -> None:
    """Falha com `NotReadOnlyError` quando o SQL não é um único SELECT só de leitura."""
    try:
        statements = parse_sql(sql)
    except ParseError as error:
        raise NotReadOnlyError("SQL inválido") from error
    if len(statements) != 1 or not isinstance(statements[0].stmt, ast.SelectStmt):
        raise NotReadOnlyError("não é um único SELECT")
    for node in _nodes(statements):
        _check(node)
