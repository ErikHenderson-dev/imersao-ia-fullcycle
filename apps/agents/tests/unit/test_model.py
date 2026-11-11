"""Modelo do Agente por AGENT_MODEL (F11-T02, CA1 e CA4)."""

import pytest
from google.adk.models import Gemini
from google.adk.models.lite_llm import LiteLlm

from app.config import ConfigError, ModelSettings
from app.model import build_model


def test_gemini_usa_o_gemini_nativo_com_3_tentativas() -> None:
    model = build_model(ModelSettings(agent_model="gemini-3.8-flash"))

    assert isinstance(model, Gemini)
    assert model.model == "gemini-3.8-flash"
    assert model.retry_options is not None
    assert model.retry_options.attempts == 3


@pytest.mark.parametrize(
    ("agent_model", "keys"),
    [
        ("openai/gpt-x", {"openai_api_key": "sk-openai"}),
        ("anthropic/claude-x", {"anthropic_api_key": "sk-anthropic"}),
    ],
)
def test_openai_e_anthropic_usam_o_lite_llm(
    agent_model: str, keys: dict[str, str]
) -> None:
    model = build_model(ModelSettings(agent_model=agent_model, **keys))

    assert isinstance(model, LiteLlm)
    assert model.model == agent_model
    assert model._additional_args["api_key"] == next(iter(keys.values()))


@pytest.mark.parametrize("agent_model", ["mistral/large", "openai/", "gemini/x"])
def test_falha_com_um_provedor_desconhecido_ou_sem_modelo(agent_model: str) -> None:
    with pytest.raises(ConfigError, match="AGENT_MODEL"):
        build_model(ModelSettings(agent_model=agent_model, openai_api_key="sk"))
