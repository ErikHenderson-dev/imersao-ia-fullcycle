"""A delegação na avaliação, respondida pelo `before_tool_callback` sem a API do chat, com o código
de produção (spec da F12, "Decisões de teste"; F12-T06, CA2)."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.agent_requests import context
from app.agent_requests.delegation_question import QUESTIONS
from app.agent_requests.question import NAO_PERGUNTE
from app.agent_requests.task import NOT_MENTIONED, REFUSALS
from app.eval_fixtures import fixture_tool_callback

pytestmark = pytest.mark.asyncio


def tool_context(**state: Any) -> SimpleNamespace:
    return SimpleNamespace(
        state={
            "eval_fixture": "canal-geral",
            context.REQUEST_ID: "pedido-1",
            context.REQUESTER_USERNAME: "ana",
            context.MENTIONS: [
                {"username": "bruno", "name": "Bruno Lima"},
                {"username": "carla", "name": "Carla Dias"},
            ],
            **state,
        },
        agent_name="assistente",
        actions=SimpleNamespace(skip_summarization=False),
    )


async def call(ctx: SimpleNamespace, name: str, **args: Any) -> dict[str, Any] | None:
    return await fixture_tool_callback(SimpleNamespace(name=name), args, ctx)  # type: ignore[arg-type]


async def test_delega_ao_mencionado_e_marca_o_pedido() -> None:
    ctx = tool_context()

    result = await call(
        ctx, "delegar_tarefa", responsavel="@Bruno", titulo="Revisar o contrato"
    )

    assert result == {"tarefa": "Revisar o contrato", "responsavel": "bruno"}
    assert ctx.state[context.ANSWERED_BY_TOOL] == {
        "pedido": "pedido-1",
        "desfecho": "task",
    }
    assert ctx.actions.skip_summarization is True


async def test_delega_a_quem_pediu() -> None:
    result = await call(
        tool_context(), "delegar_tarefa", responsavel="ana", titulo="Revisar o roteiro"
    )

    assert result == {"tarefa": "Revisar o roteiro", "responsavel": "ana"}


@pytest.mark.parametrize(
    ("args", "erro", "state"),
    [
        ({"responsavel": "carlos", "titulo": "Pagar"}, NOT_MENTIONED, {}),
        ({"responsavel": "@", "titulo": "Pagar"}, REFUSALS["assignee_not_member"], {}),
        (
            {"responsavel": "carla", "titulo": "Pagar"},
            REFUSALS["assignee_not_member"],
            {"eval_non_members": ["carla"]},
        ),
        ({"responsavel": "bruno", "titulo": "   "}, REFUSALS["validation_failed"], {}),
        (
            {"responsavel": "bruno", "titulo": "a" * 121},
            REFUSALS["validation_failed"],
            {},
        ),
    ],
)
async def test_as_recusas_voltam_ao_modelo_sem_marcar(
    args: dict[str, str], erro: str, state: dict[str, Any]
) -> None:
    ctx = tool_context(**state)

    result = await call(ctx, "delegar_tarefa", **args)

    assert result == {"erro": erro}
    assert context.ANSWERED_BY_TOOL not in ctx.state
    assert ctx.actions.skip_summarization is False


async def test_pergunta_qual_com_os_rotulos_e_marca_o_pedido() -> None:
    ctx = tool_context()

    result = await call(
        ctx, "perguntar_delegacao", falta="qual", candidatos=["bruno", "@carla"]
    )

    assert result == {
        "pergunta": QUESTIONS["qual"],
        "candidatos": [
            {"rotulo": "Bruno Lima", "usuario": "bruno"},
            {"rotulo": "Carla Dias", "usuario": "carla"},
        ],
    }
    assert ctx.state[context.ANSWERED_BY_TOOL]["desfecho"] == "question"


async def test_pergunta_o_que_falta_sem_candidatos() -> None:
    result = await call(tool_context(), "perguntar_delegacao", falta="responsavel")

    assert result == {"pergunta": QUESTIONS["responsavel"], "candidatos": []}


@pytest.mark.parametrize(
    ("args", "state"),
    [
        ({"falta": "responsavel"}, {context.KIND: "continuation"}),
        ({"falta": "quem"}, {}),
        ({"falta": "qual", "candidatos": ["bruno", "caio"]}, {}),
    ],
)
async def test_a_pergunta_recusada_nao_marca(
    args: dict[str, Any], state: dict[str, Any]
) -> None:
    ctx = tool_context(**state)

    result = await call(ctx, "perguntar_delegacao", **args)

    assert result is not None and "erro" in result
    if state:
        assert result == {"erro": NAO_PERGUNTE}
    assert context.ANSWERED_BY_TOOL not in ctx.state


async def test_fora_da_avaliacao_a_ferramenta_roda() -> None:
    ctx = tool_context()
    del ctx.state["eval_fixture"]

    assert await call(ctx, "delegar_tarefa", responsavel="bruno", titulo="X") is None
    assert await call(ctx, "perguntar_delegacao", falta="o_que") is None
