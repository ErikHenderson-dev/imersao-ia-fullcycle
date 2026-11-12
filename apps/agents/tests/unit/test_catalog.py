"""Catálogo dos Agentes pelo card.py de cada pasta (F10-T04, CA3)."""

from pathlib import Path

import pytest

from app.registry.catalog import CatalogError, load_catalog


def write_agent(root: Path, slug: str, card: str | None) -> None:
    folder = root / slug
    folder.mkdir()
    (folder / "agent.py").write_text(
        "raise RuntimeError('o catálogo não importa o agent.py')\n"
    )
    if card is not None:
        (folder / "card.py").write_text(card)


def test_o_assistente_vem_do_card_py_com_o_texto_do_frame() -> None:
    catalog = load_catalog()

    assistente = next(card for card in catalog if card.slug == "assistente")
    assert assistente.name == "Assistente"
    assert assistente.username == "assistente"
    assert assistente.description == (
        "Resume conversas, delega tarefas para quem você mencionar e responde perguntas "
        "sobre os dados do negócio."
    )


def test_monta_um_agente_por_pasta_com_o_slug_da_pasta(tmp_path: Path) -> None:
    write_agent(tmp_path, "zeta", 'NAME = "Zeta"\nDESCRIPTION = "Faz z."\n')
    write_agent(tmp_path, "alfa", 'NAME = "Alfa"\nDESCRIPTION = "Faz a."\n')
    (tmp_path / "__pycache__").mkdir()

    catalog = load_catalog(tmp_path)

    assert [(card.slug, card.name) for card in catalog] == [
        ("alfa", "Alfa"),
        ("zeta", "Zeta"),
    ]


def test_falha_com_o_nome_da_pasta_sem_card_py(tmp_path: Path) -> None:
    write_agent(tmp_path, "alfa", 'NAME = "Alfa"\nDESCRIPTION = "Faz a."\n')
    write_agent(tmp_path, "sem-cartao", None)

    with pytest.raises(CatalogError, match="sem-cartao"):
        load_catalog(tmp_path)


def test_falha_com_o_card_py_sem_nome(tmp_path: Path) -> None:
    write_agent(tmp_path, "alfa", 'DESCRIPTION = "Faz a."\n')

    with pytest.raises(CatalogError, match="alfa"):
        load_catalog(tmp_path)
