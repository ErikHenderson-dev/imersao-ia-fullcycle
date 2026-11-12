"""Configuração do Serviço de agentes (F10-T04, CA1)."""

import pytest

from app.config import ConfigError, load_settings

REQUIRED = {
    "DATABASE_URL": "postgresql+asyncpg://agents:agents@postgres:5432/agents",
    "AGENTS_SERVICE_TOKEN": "segredo",
}
OPTIONAL = ["ADK_DEV_ROUTES", "SESSION_SERVICE_URI", "ALLOW_ORIGINS"]


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    for name in [*REQUIRED, *OPTIONAL]:
        monkeypatch.delenv(name, raising=False)
    for name, value in REQUIRED.items():
        monkeypatch.setenv(name, value)
    return monkeypatch


def test_le_as_variaveis_tipadas(env: pytest.MonkeyPatch) -> None:
    env.setenv("ADK_DEV_ROUTES", "true")
    env.setenv("SESSION_SERVICE_URI", "postgresql+asyncpg://x")
    env.setenv("ALLOW_ORIGINS", "http://a.test, http://b.test")

    settings = load_settings()

    assert settings.database_url == REQUIRED["DATABASE_URL"]
    assert settings.agents_service_token == "segredo"
    assert settings.adk_dev_routes is True
    assert settings.session_service_uri == "postgresql+asyncpg://x"
    assert settings.allow_origins_list == ["http://a.test", "http://b.test"]


def test_adk_dev_routes_e_falso_quando_ausente(env: pytest.MonkeyPatch) -> None:
    settings = load_settings()

    assert settings.adk_dev_routes is False
    assert settings.allow_origins_list is None


@pytest.mark.parametrize("name", list(REQUIRED))
def test_falha_com_o_nome_da_variavel_obrigatoria_ausente(
    env: pytest.MonkeyPatch, name: str
) -> None:
    env.delenv(name)

    with pytest.raises(ConfigError, match=name):
        load_settings()


def test_falha_com_a_credencial_vazia(env: pytest.MonkeyPatch) -> None:
    env.setenv("AGENTS_SERVICE_TOKEN", "  ")

    with pytest.raises(ConfigError, match="AGENTS_SERVICE_TOKEN"):
        load_settings()
