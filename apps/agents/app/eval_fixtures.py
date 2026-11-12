"""As Conversas da avaliação, injetadas pelo `before_tool_callback` (spec da F11, "Decisões de
teste"; F11-T04).

O callback só age quando o estado da sessão tem `eval_fixture`, que só o `session_input.state` do
evalset preenche: o estado de um Pedido real vem do `request_state`, que nunca tem essa chave, e o
modelo não grava estado. Com ela, responde a `ler_mensagens` pela mesma `read_recorte` de
produção, com a Conversa de `tests/eval/<agente>/fixtures/<nome>.json` no lugar da API do chat.

Formato da fixture: `{"mensagens": [{"autor", "usuario", "texto", "quando", "bot"?, "apagada"?}]}`,
com `quando` em ISO UTC. As Mensagens com `bot` ou `apagada` verdadeiro ficam fora da leitura e das
contagens, como na rota (F11-T08). A `perguntar_recorte` (F11-T07) recebe as contagens da mesma
Conversa, e a pergunta não é gravada: o estado e o fim do turno ficam como na produção.

A delegação (F12-T06) roda as funções de produção (`delegate` e `ask_delegation`) com a API do
chat da avaliação (`EvalChatApi`), que não grava nada: a conferência do Responsável, a montagem da
pergunta e a marca de Pedido respondido são as mesmas. Para a recusa de quem não é Membro, que vem da
API, o caso lista em `eval_non_members` os @usuário que a API recusaria.
"""

from __future__ import annotations

import functools
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from google.adk.tools import BaseTool, ToolContext

from app.agent_requests.delegation_question import ask_delegation
from app.agent_requests.question import question_asked, recorte_options
from app.agent_requests.reading import read_recorte
from app.agent_requests.task import TASK_TITLE_MAX_LENGTH, delegate
from app.chat_api import ChatApiError

FIXTURE_KEY = "eval_fixture"
# Os @usuário que a API do chat recusaria como Responsável por não serem Membros (F12-T06).
NON_MEMBERS_KEY = "eval_non_members"
# Os bots que a API do chat recusaria como Responsável; sem a chave no caso, o próprio Agente.
BOTS_KEY = "eval_bots"
# O Responsável que o caso espera: outro faz a ação `task` ser recusada, e o caso reprova (F12-T06).
EXPECTED_ASSIGNEE_KEY = "eval_expected_assignee"
TOOLS = ("ler_mensagens", "perguntar_recorte", "delegar_tarefa", "perguntar_delegacao")
PROJECT_DIR = Path(__file__).resolve().parents[1]
FIXTURE_NAME = re.compile(r"^[a-z0-9-]+$")
# O teto da rota de leitura do bot ("Teto de Mensagens do resumo").
SUMMARY_MESSAGE_LIMIT = 500


@functools.cache
def fixture_source(agent: str, name: str) -> FixtureSource:
    """A fonte de uma fixture, lida uma vez por execução da avaliação."""
    if not FIXTURE_NAME.match(name):
        raise ValueError(f"Nome de fixture inválido: {name}")
    path = PROJECT_DIR / "tests" / "eval" / agent / "fixtures" / f"{name}.json"
    return FixtureSource(json.loads(path.read_text(encoding="utf-8"))["mensagens"])


class FixtureSource:
    """As Mensagens de uma fixture, filtradas como a rota de leitura do bot."""

    def __init__(self, messages: list[dict[str, Any]]) -> None:
        # Cada Mensagem com o instante já lido, em ordem cronológica.
        self._messages = sorted(
            (
                (datetime.fromisoformat(message["quando"]), message)
                for message in messages
                # A rota lê só Mensagens de Pessoas, sem as apagadas.
                if not message.get("bot") and not message.get("apagada")
            ),
            key=lambda pair: pair[0],
        )

    async def count(self, sinces: list[datetime], until: datetime) -> dict[str, Any]:
        """As contagens como a rota de contagens do bot, pela mesma filtragem da leitura."""
        totals = [
            (await self.read(since, until, None))["total"] for since in [*sinces, None]
        ]
        return {
            "counts": [
                {"since": since.isoformat(), "count": count}
                for since, count in zip(sinces, totals, strict=False)
            ],
            "total": totals[-1],
        }

    async def read(
        self, since: datetime | None, until: datetime, author_username: str | None
    ) -> dict[str, Any]:
        selected = [
            message
            for at, message in self._messages
            if (since is None or at >= since)
            and at < until
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
    if not name or tool.name not in TOOLS:
        return None
    if tool.name == "delegar_tarefa":
        return await delegate(
            EvalChatApi(tool_context.state),  # type: ignore[arg-type]
            tool_context,
            args.get("responsavel", ""),
            args.get("titulo", ""),
        )
    if tool.name == "perguntar_delegacao":
        return await ask_delegation(
            EvalChatApi(tool_context.state),  # type: ignore[arg-type]
            tool_context,
            args.get("falta", ""),
            args.get("candidatos"),
        )
    source = fixture_source(tool_context.agent_name, name)
    if tool.name == "perguntar_recorte":
        options = await recorte_options(source, tool_context.state)
        return question_asked(tool_context, options)
    return await read_recorte(
        source, tool_context.state, args.get("recorte", ""), args.get("pessoa")
    )


class EvalChatApi:
    """A API do chat da avaliação: as ferramentas de delegação rodam o código de produção, e só as
    ações chegam aqui. A pergunta não é gravada; a ação `task` recusa como a API, pelo caso
    (`eval_non_members`) e pelo limite do título."""

    def __init__(self, state: Any) -> None:
        self._non_members = set(state.get(NON_MEMBERS_KEY) or [])
        self._bots = set(state.get(BOTS_KEY) or ["assistente"])
        self._expected = state.get(EXPECTED_ASSIGNEE_KEY)

    async def question(
        self, request_id: str, body: str, quick_replies: list[str]
    ) -> None:
        return None

    async def task(self, request_id: str, assignee_username: str, title: str) -> None:
        if assignee_username in self._bots:
            raise ChatApiError("recusada", 422, "assignee_is_bot")
        if assignee_username in self._non_members:
            raise ChatApiError("recusada", 422, "assignee_not_member")
        if self._expected and assignee_username != self._expected:
            raise ChatApiError("recusada", 422, "assignee_not_member")
        # A ação apara o título e conta os caracteres (code points), como o `len` do Python.
        if not title.strip() or len(title.strip()) > TASK_TITLE_MAX_LENGTH:
            raise ChatApiError("recusada", 400, "validation_failed")
