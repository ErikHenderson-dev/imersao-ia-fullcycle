"""A busca por nome (spec da F13, "Catálogo e consulta", `names.py`; F13-T05, CA2)."""

from __future__ import annotations

import pytest

from app.business.names import matching

SELLERS = [
    (1, "Ana Beatriz Costa"),
    (2, "Ana Paula Ramos"),
    (3, "Bruno Carvalho"),
    (4, "Juliana Antunes"),
]


@pytest.mark.parametrize("query", ["ana b", "ANA B", "Âna B", "  ana   b "])
def test_acha_por_trecho_sem_maiusculas_nem_acentos(query: str) -> None:
    assert matching(SELLERS, query) == [(1, "Ana Beatriz Costa")]


def test_o_nome_completo_igual_vence_os_trechos() -> None:
    rows = [(1, "Ana Paula"), (2, "Ana Paula Ramos")]

    assert matching(rows, "ana paula") == [(1, "Ana Paula")]


def test_acha_todos_os_que_tem_o_trecho() -> None:
    assert [row_id for row_id, _ in matching(SELLERS, "ana")] == [1, 2, 4]


def test_nenhum_achado() -> None:
    assert matching(SELLERS, "Zé") == []
