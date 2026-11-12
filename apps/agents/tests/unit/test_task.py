"""A delegação de Tarefa pela ferramenta, sem o modelo (spec da F12, "O Agente `assistente`";
F12-T01, revisão)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.agent_requests import context
from app.agent_requests.task import REFUSALS, delegate
from app.chat_api import ChatApiError

pytestmark = pytest.mark.asyncio


class FakeClient:
    """Responde às chamadas da ação `task`, na ordem, com os erros dados; depois, sucesso."""

    def __init__(self, errors: list[ChatApiError]) -> None:
        self.errors = errors
        self.calls: list[tuple[str, str, str]] = []

    async def task(self, request_id: str, assignee_username: str, title: str) -> None:
        self.calls.append((request_id, assignee_username, title))
        if self.errors:
            raise self.errors.pop(0)


def tool_context() -> SimpleNamespace:
    return SimpleNamespace(
        state={context.REQUEST_ID: "pedido-1"},
        actions=SimpleNamespace(skip_summarization=False),
    )


async def test_delega_e_marca_o_pedido_como_respondido() -> None:
    client, ctx = FakeClient([]), tool_context()

    result = await delegate(client, ctx, "@Bruno", "Revisar o contrato")  # type: ignore[arg-type]

    assert client.calls == [("pedido-1", "bruno", "Revisar o contrato")]
    assert result == {"tarefa": "Revisar o contrato", "responsavel": "bruno"}
    assert ctx.state[context.ANSWERED_BY_TOOL] == {
        "pedido": "pedido-1",
        "desfecho": "task",
    }
    assert ctx.actions.skip_summarization is True


@pytest.mark.parametrize(
    "code", ["assignee_not_member", "assignee_is_bot", "validation_failed"]
)
async def test_a_recusa_volta_ao_modelo_sem_marcar(code: str) -> None:
    client, ctx = FakeClient([ChatApiError("recusada", 422, code)]), tool_context()

    result = await delegate(client, ctx, "bruno", "Revisar")  # type: ignore[arg-type]

    assert result == {"erro": REFUSALS[code]}
    assert context.ANSWERED_BY_TOOL not in ctx.state
    assert len(client.calls) == 1


@pytest.mark.parametrize("status", [None, 503])
async def test_sem_resposta_ou_com_erro_do_servidor_tenta_de_novo(
    status: int | None,
) -> None:
    client, ctx = FakeClient([ChatApiError("caiu", status)]), tool_context()

    result = await delegate(client, ctx, "bruno", "Revisar")  # type: ignore[arg-type]

    assert len(client.calls) == 2
    assert result["responsavel"] == "bruno"
    assert ctx.state[context.ANSWERED_BY_TOOL]["desfecho"] == "task"


async def test_o_pedido_recusado_sobe_sem_tentar_de_novo() -> None:
    client = FakeClient([ChatApiError("vencido", 410, "request_expired")])

    with pytest.raises(ChatApiError):
        await delegate(client, tool_context(), "bruno", "Revisar")  # type: ignore[arg-type]

    assert len(client.calls) == 1
