"""A pergunta da delegação incompleta (spec da F12, "O Agente `assistente`"; F12-T04, CA1 a CA3)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.agent_requests import context
from app.agent_requests.delegation_question import (
    QUESTIONS,
    ask_delegation,
    candidate_labels,
)

pytestmark = pytest.mark.asyncio

MENTIONS = [
    {"username": "bruno", "name": "Bruno Lima"},
    {"username": "caio", "name": "Caio Dias"},
]


class FakeClient:
    def __init__(self) -> None:
        self.questions: list[tuple[str, str, list[str]]] = []

    async def question(
        self, request_id: str, body: str, quick_replies: list[str]
    ) -> None:
        self.questions.append((request_id, body, quick_replies))


def tool_context(
    kind: str = "new", mentions: list[dict] | None = None
) -> SimpleNamespace:
    return SimpleNamespace(
        state={
            context.REQUEST_ID: "pedido-1",
            context.KIND: kind,
            context.MENTIONS: MENTIONS if mentions is None else mentions,
        },
        actions=SimpleNamespace(skip_summarization=False),
    )


@pytest.mark.parametrize(
    ("falta", "texto"),
    [
        ("responsavel", "A quem eu delego?"),
        ("o_que", "O que devo delegar?"),
    ],
)
async def test_pergunta_o_que_falta_com_o_texto_fixo(falta: str, texto: str) -> None:
    client, ctx = FakeClient(), tool_context()

    await ask_delegation(client, ctx, falta, None)  # type: ignore[arg-type]

    assert QUESTIONS[falta] == texto
    assert client.questions == [("pedido-1", texto, [])]
    assert ctx.state[context.ANSWERED_BY_TOOL] == {
        "pedido": "pedido-1",
        "desfecho": "question",
    }
    assert ctx.actions.skip_summarization is True


async def test_pergunta_qual_com_os_candidatos() -> None:
    client, ctx = FakeClient(), tool_context()

    result = await ask_delegation(client, ctx, "qual", ["@bruno", "caio"])  # type: ignore[arg-type]

    assert client.questions == [
        ("pedido-1", "Para quem é a Tarefa?", ["Bruno Lima", "Caio Dias"])
    ]
    assert result["candidatos"] == [
        {"rotulo": "Bruno Lima", "usuario": "bruno"},
        {"rotulo": "Caio Dias", "usuario": "caio"},
    ]


def test_os_rotulos_dos_candidatos() -> None:
    mentions = [
        {"username": "ana", "name": "Ana Souza"},
        {"username": "ana.s", "name": "Ana Souza"},
        {"username": "long", "name": "N" * 80},
        {"username": "d", "name": "Dora"},
        {"username": "e", "name": "Eva"},
    ]

    labels = candidate_labels(["ana", "@ana.s", "long", "d", "e", "fora"], mentions)

    assert [label for label, _ in labels] == [
        "Ana Souza (ana)",
        "Ana Souza (ana.s)",
        "N" * 64,
        "Dora",
    ]
    assert all("@" not in label for label, _ in labels)


async def test_nao_pergunta_numa_continuacao() -> None:
    client, ctx = FakeClient(), tool_context(kind="continuation")

    result = await ask_delegation(client, ctx, "responsavel", None)  # type: ignore[arg-type]

    assert client.questions == []
    assert "erro" in result
    assert context.ANSWERED_BY_TOOL not in ctx.state
