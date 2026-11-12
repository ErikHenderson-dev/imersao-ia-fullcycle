"""A consulta da avaliação contra o Banco de negócio com os dados fixos (F13-T07, CA2).

O callback da avaliação deixa `consultar_dados` rodar com a API do chat da avaliação, e a resposta
que a ferramenta grava fica no estado do caso, sem auditoria.
"""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace

import pytest

from app.agents.assistente.tools import consultar_dados, gerar_relatorio
from app.eval_fixtures import (
    EVAL_ANSWER_KEY,
    EVAL_REPORT_KEY,
    eval_business_store,
    fixture_tool_callback,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.fixture
def eval_business(
    loaded_business_test: str, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    """O Banco de negócio da avaliação apontado para o de teste; o cache sai limpo mesmo na falha."""
    monkeypatch.setenv("BUSINESS_DATABASE_URL", loaded_business_test)
    eval_business_store.cache_clear()
    yield
    eval_business_store.cache_clear()


async def test_a_consulta_da_avaliacao_grava_a_resposta_no_estado(
    loaded_business_test: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("BUSINESS_DATABASE_URL", loaded_business_test)
    eval_business_store.cache_clear()
    state = {
        "eval_fixture": "canal-geral",
        "request_id": "0198f000-0000-7000-8000-000000000001",
        "requester_id": "0198f000-0000-7000-8000-00000000a0a0",
        "conversation_id": "0198f000-0000-7000-8000-00000000c0c0",
        "data_access": True,
    }
    ctx = SimpleNamespace(
        state=state,
        agent_name="assistente",
        actions=SimpleNamespace(skip_summarization=False),
    )
    await fixture_tool_callback(SimpleNamespace(name="consultar_dados"), {}, ctx)  # type: ignore[arg-type]

    await consultar_dados("pedidos", "2026-03-01", "2026-03-31", ctx)  # type: ignore[arg-type]

    answer = state[EVAL_ANSWER_KEY]
    assert answer["resposta"].startswith("Pedidos pagos em março de 2026: ")
    assert answer["business_data"] is True
    await eval_business_store().dispose()
    eval_business_store.cache_clear()


async def test_o_relatorio_da_avaliacao_grava_o_aviso_e_a_carga_no_estado(
    eval_business: None,
) -> None:
    """F14-T07, CA1: `gerar_relatorio` roda até o aviso, sem Worker nem Redis."""
    state = {
        "eval_fixture": "canal-geral",
        "request_id": "0198f000-0000-7000-8000-000000000001",
        "requester_id": "0198f000-0000-7000-8000-00000000a0a0",
        "conversation_id": "0198f000-0000-7000-8000-00000000c0c0",
        "data_access": True,
        "business_today": "2026-10-15",
        "requested_at": "2026-10-15T15:00:00.000Z",
        "kind": "new",
    }
    ctx = SimpleNamespace(
        state=state,
        agent_name="assistente",
        actions=SimpleNamespace(skip_summarization=False),
    )
    await fixture_tool_callback(SimpleNamespace(name="gerar_relatorio"), {}, ctx)  # type: ignore[arg-type]

    await gerar_relatorio(  # type: ignore[arg-type]
        "2026-03-01", "2026-03-31", ctx, "vendedor", "Ana Paula Ramos"
    )

    assert state[EVAL_ANSWER_KEY] == {
        "aviso": "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026, vendedor Ana Paula "
        "Ramos. Ele chega aqui quando ficar pronto."
    }
    report = state[EVAL_REPORT_KEY]
    assert report["previous_period"] == {"start": "2026-02-01", "end": "2026-02-28"}
    assert report["filter"]["name"] == "Ana Paula Ramos"
    await eval_business_store().dispose()
