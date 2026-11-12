"""O teto de custo de todo Pedido (spec da F11, "Modelo de IA"; F11-T06, CA5)."""

import pytest
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agent_requests.execution import ExecutionDeps
from app.agents.assistente.agent import root_agent
from app.chat_api import ChatApiClient


@pytest.mark.asyncio
async def test_o_pedido_roda_com_no_maximo_4_chamadas_ao_modelo() -> None:
    deps = ExecutionDeps(
        session_service=InMemorySessionService(),
        chat_api=ChatApiClient("http://127.0.0.1:9", "credencial"),
    )

    assert deps.run_config.max_llm_calls == 4
    await deps.chat_api.close()


def test_o_assistente_escreve_no_maximo_1024_tokens_por_chamada() -> None:
    assert root_agent.generate_content_config is not None
    assert root_agent.generate_content_config.max_output_tokens == 1024


def test_o_assistente_raciocina_no_nivel_minimo() -> None:
    # O raciocínio conta nos 1024 tokens de saída: no nível baixo, ainda cortava 11 de 20 resumos de
    # 500 Mensagens (medição da F11-T08).
    config = root_agent.generate_content_config
    assert config is not None and config.thinking_config is not None
    assert config.thinking_config.thinking_level == types.ThinkingLevel.MINIMAL
