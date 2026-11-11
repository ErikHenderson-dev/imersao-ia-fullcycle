"""O teto de custo de todo Pedido (spec da F11, "Modelo de IA"; F11-T06, CA5)."""

import pytest
from google.adk.sessions import InMemorySessionService

from app.agent_requests.execution import ExecutionDeps
from app.agents.assistente.agent import root_agent
from app.chat_api import ChatApiClient


@pytest.mark.asyncio
async def test_o_pedido_roda_com_no_maximo_4_chamadas_ao_modelo() -> None:
    chat_api = ChatApiClient("http://127.0.0.1:9", "credencial")

    deps = ExecutionDeps(session_service=InMemorySessionService(), chat_api=chat_api)

    assert deps.run_config.max_llm_calls == 4
    await chat_api.close()


def test_o_assistente_escreve_no_maximo_1024_tokens_por_chamada() -> None:
    assert root_agent.generate_content_config is not None
    assert root_agent.generate_content_config.max_output_tokens == 1024
