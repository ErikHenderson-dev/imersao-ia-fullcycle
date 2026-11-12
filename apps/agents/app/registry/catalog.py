"""Catálogo dos Agentes que a instalação traz, montado do `card.py` de cada pasta."""

from __future__ import annotations

import importlib.util
from dataclasses import dataclass
from pathlib import Path

AGENTS_DIR = Path(__file__).resolve().parent.parent / "agents"


class CatalogError(Exception):
    """Uma pasta de agente não traz o que o catálogo precisa."""


@dataclass(frozen=True)
class AgentCard:
    # O nome da pasta, que é o nome do App do ADK e o @usuário do bot.
    slug: str
    # O nome de exibição e a descrição da tela.
    name: str
    description: str

    @property
    def username(self) -> str:
        return self.slug


def _agent_dirs(agents_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in agents_dir.iterdir()
        if path.is_dir() and not path.name.startswith(("_", "."))
    )


def _read_card(agent_dir: Path) -> AgentCard:
    card_path = agent_dir / "card.py"
    if not card_path.is_file():
        raise CatalogError(f"O agente {agent_dir.name} não tem card.py")
    # Lê só o card.py, sem importar o agent.py (que cria o modelo).
    spec = importlib.util.spec_from_file_location(
        f"_agent_card_{agent_dir.name}", card_path
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    name = getattr(module, "NAME", None)
    description = getattr(module, "DESCRIPTION", None)
    if not isinstance(name, str) or not name.strip():
        raise CatalogError(f"O card.py do agente {agent_dir.name} não tem NAME")
    if not isinstance(description, str) or not description.strip():
        raise CatalogError(f"O card.py do agente {agent_dir.name} não tem DESCRIPTION")
    return AgentCard(slug=agent_dir.name, name=name, description=description)


def load_catalog(agents_dir: Path = AGENTS_DIR) -> list[AgentCard]:
    """Um Agente por pasta de `agents_dir`, em ordem de nome."""
    cards = [_read_card(agent_dir) for agent_dir in _agent_dirs(agents_dir)]
    return sorted(cards, key=lambda card: card.name.casefold())
