"""O modelo dos Agentes, escolhido por AGENT_MODEL (spec da F11, "Modelo de IA").

Todo agente de app/agents/ faz model=build_model() no agent.py. O módulo fica fora de app/agents/
porque o ADK trata cada entrada dali como um agente.
"""

from __future__ import annotations

from google.adk.models import BaseLlm, Gemini
from google.genai import types

from app.config import ModelSettings, load_model_settings

# Tentativas do cliente do Gemini numa falha transitória; a spec da F11 ("Modelo de IA") as dá só
# ao caminho nativo, e o LiteLlm segue sem elas.
GEMINI_ATTEMPTS = 3

# Tokens de saída por chamada ao modelo, parte do teto de custo por Pedido (spec da F11, "Modelo de
# IA"; LLD, "Valores e configuração"). Todo agente o aplica no generate_content_config, para o adk eval
# rodar com o mesmo teto da produção.
MAX_OUTPUT_TOKENS = 1024
# O raciocínio do modelo conta nos tokens de saída: sem limite, ele chegou a gastar 984 dos 1024 e
# cortou o resumo (avaliação da F11-T08); no nível baixo, ainda cortava 11 de 20 resumos de 500
# Mensagens (medição da F11-T08). O modelo Gemini precisa aceitar o nível mínimo (LLD, "Acesso ao
# modelo"); o LiteLlm o traduz no esforço de raciocínio do provedor que o aceita.
THINKING_LEVEL = types.ThinkingLevel.MINIMAL


def generation_config() -> types.GenerateContentConfig:
    """A configuração de geração comum aos agentes, com o teto de tokens de saída e o nível de
    raciocínio."""
    return types.GenerateContentConfig(
        max_output_tokens=MAX_OUTPUT_TOKENS,
        thinking_config=types.ThinkingConfig(thinking_level=THINKING_LEVEL),
    )


def build_model(settings: ModelSettings | None = None) -> BaseLlm:
    """O Gemini nativo do ADK para gemini-…, e o LiteLlm para openai/… e anthropic/…."""
    settings = settings or load_model_settings()
    settings.check_model()
    if settings.provider == "gemini":
        return Gemini(
            model=settings.agent_model,
            retry_options=types.HttpRetryOptions(attempts=GEMINI_ATTEMPTS),
        )
    # Import sob demanda: o do litellm é lento, e o caminho principal é o Gemini.
    from google.adk.models.lite_llm import LiteLlm

    return LiteLlm(model=settings.agent_model, api_key=settings.provider_api_key)
