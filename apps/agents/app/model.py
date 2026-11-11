"""O modelo dos Agentes, escolhido por AGENT_MODEL (spec da F11, "Modelo de IA").

Todo agente de app/agents/ faz model=build_model() no agent.py. O módulo fica fora de app/agents/
porque o ADK trata cada entrada dali como um agente.
"""

from __future__ import annotations

from google.adk.models import BaseLlm, Gemini
from google.genai import types

from app.config import ModelSettings, load_model_settings

# Tentativas do cliente do Gemini numa falha transitória; o LiteLlm não tem equivalente no ADK.
GEMINI_ATTEMPTS = 3


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
