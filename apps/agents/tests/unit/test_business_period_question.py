"""A pergunta de período da consulta (spec da F13, "O Agente `assistente`", `perguntar_periodo`;
F13-T06, CA1)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.agent_requests import context
from app.agent_requests.question import NAO_PERGUNTE
from app.business.period_question import ask_period

pytestmark = pytest.mark.asyncio


class FakeClient:
    def __init__(self) -> None:
        self.questions: list[tuple] = []

    async def question(
        self,
        request_id: str,
        body: str,
        quick_replies: list[str],
        *,
        business_data: bool = False,
    ) -> None:
        self.questions.append((request_id, body, quick_replies, business_data))


def tool_context(kind: str) -> SimpleNamespace:
    return SimpleNamespace(
        state={context.REQUEST_ID: "pedido-1", context.KIND: kind},
        actions=SimpleNamespace(skip_summarization=False),
    )


async def test_grava_a_pergunta_de_periodo_com_as_tres_respostas_prontas_sem_a_marca() -> (
    None
):
    client, ctx = FakeClient(), tool_context("new")

    await ask_period(client, ctx)  # type: ignore[arg-type]

    assert client.questions == [
        ("pedido-1", "De que período?", ["Este mês", "Mês passado", "Este ano"], False)
    ]
    assert ctx.state[context.ANSWERED_BY_TOOL] == {
        "pedido": "pedido-1",
        "desfecho": "question",
    }


async def test_recusa_perguntar_numa_continuacao() -> None:
    client, ctx = FakeClient(), tool_context("continuation")

    result = await ask_period(client, ctx)  # type: ignore[arg-type]

    assert result == {"erro": NAO_PERGUNTE}
    assert client.questions == []
    assert context.ANSWERED_BY_TOOL not in ctx.state
