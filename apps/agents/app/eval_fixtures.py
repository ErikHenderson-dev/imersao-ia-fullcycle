"""As Conversas da avaliação, injetadas pelo `before_tool_callback` (spec da F11, "Decisões de
teste"; F11-T04).

O callback só age quando o estado da sessão tem `eval_fixture`, que só o `session_input.state` do
evalset preenche: o estado de um Pedido real vem do `request_state`, que nunca tem essa chave, e o
modelo não grava estado. Com ela, responde a `ler_mensagens` pela mesma `read_recorte` de
produção, com a Conversa de `tests/eval/<agente>/fixtures/<nome>.json` no lugar da API do chat.

Formato da fixture: `{"mensagens": [{"autor", "usuario", "texto", "quando"}]}`, só Mensagens de
Pessoas, com `quando` em ISO UTC. A F11-T07 acrescenta a resposta da `perguntar_recorte`.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from google.adk.tools import BaseTool, ToolContext

from app.agent_requests.reading import read_recorte

FIXTURE_KEY = "eval_fixture"
PROJECT_DIR = Path(__file__).resolve().parents[1]
FIXTURE_NAME = re.compile(r"^[a-z0-9-]+$")
# O teto da rota de leitura do bot ("Teto de Mensagens do resumo").
SUMMARY_MESSAGE_LIMIT = 500


def load_fixture(agent: str, name: str) -> list[dict[str, Any]]:
    if not FIXTURE_NAME.match(name):
        raise ValueError(f"Nome de fixture inválido: {name}")
    path = PROJECT_DIR / "tests" / "eval" / agent / "fixtures" / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8"))["mensagens"]


class FixtureSource:
    """As Mensagens de uma fixture, filtradas como a rota de leitura do bot."""

    def __init__(self, messages: list[dict[str, Any]]) -> None:
        self._messages = sorted(messages, key=lambda message: message["quando"])

    async def read(
        self, since: datetime | None, until: datetime, author_username: str | None
    ) -> dict[str, Any]:
        selected = [
            message
            for message in self._messages
            if (since is None or datetime.fromisoformat(message["quando"]) >= since)
            and datetime.fromisoformat(message["quando"]) < until
            and (author_username is None or message["usuario"] == author_username)
        ]
        return {
            "total": len(selected),
            "messages": [
                {
                    "id": str(index),
                    "author": {
                        "name": message["autor"],
                        "username": message["usuario"],
                    },
                    "body": message["texto"],
                    "created_at": message["quando"],
                }
                for index, message in enumerate(selected[-SUMMARY_MESSAGE_LIMIT:])
            ],
        }


async def fixture_tool_callback(
    tool: BaseTool, args: dict[str, Any], tool_context: ToolContext
) -> dict[str, Any] | None:
    """Responde à ferramenta com a fixture do caso; fora da avaliação, deixa a ferramenta rodar."""
    name = tool_context.state.get(FIXTURE_KEY)
    if not name or tool.name != "ler_mensagens":
        return None
    source = FixtureSource(load_fixture(tool_context.agent_name, name))
    return await read_recorte(
        source, tool_context.state, args.get("recorte", ""), args.get("pessoa")
    )
