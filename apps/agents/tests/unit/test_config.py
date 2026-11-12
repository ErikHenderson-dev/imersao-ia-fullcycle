"""Configuração do Serviço de agentes (F10-T04, CA1; F11-T02, CA3; F11-T03; F11-T06, CA2)."""

import pytest

from app.config import (
    ConfigError,
    load_business_load_settings,
    load_model_settings,
    load_settings,
)

REQUIRED = {
    "DATABASE_URL": "postgresql+asyncpg://agents:agents@postgres:5432/agents",
    "AGENTS_SERVICE_TOKEN": "segredo",
    "AGENT_MODEL": "gemini-3.8-flash",
    "CHAT_API_URL": "http://chat-api:3000",
    "CHAT_BOT_TOKEN": "segredo-do-bot",
    "REDIS_URL": "redis://redis:6379/0",
    "BUSINESS_DATABASE_URL": "postgresql+asyncpg://business_readonly:x@postgres:5432/business",
}
OPTIONAL = [
    "ADK_DEV_ROUTES",
    "SESSION_SERVICE_URI",
    "ALLOW_ORIGINS",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "AGENT_REQUESTS_PER_MINUTE",
    "BUSINESS_TIME_ZONE",
    "BUSINESS_QUERY_TIMEOUT_MS",
    "BUSINESS_OWNER_DATABASE_URL",
]


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
    assert settings.agent_model == "gemini-3.8-flash"
    assert settings.adk_dev_routes is True
    assert settings.session_service_uri == "postgresql+asyncpg://x"
    assert settings.allow_origins_list == ["http://a.test", "http://b.test"]


def test_adk_dev_routes_e_falso_quando_ausente(env: pytest.MonkeyPatch) -> None:
    settings = load_settings()

    assert settings.adk_dev_routes is False
    assert settings.allow_origins_list is None
    assert settings.agent_requests_per_minute == 10


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


def test_as_chaves_dos_outros_provedores_sao_opcionais_com_o_gemini(
    env: pytest.MonkeyPatch,
) -> None:
    settings = load_settings()

    assert settings.openai_api_key is None
    assert settings.anthropic_api_key is None


@pytest.mark.parametrize(
    ("agent_model", "key"),
    [
        ("openai/gpt-x", "OPENAI_API_KEY"),
        ("anthropic/claude-x", "ANTHROPIC_API_KEY"),
    ],
)
@pytest.mark.parametrize("value", [None, "  "])
@pytest.mark.parametrize("load", [load_settings, load_model_settings])
def test_falha_sem_a_chave_do_provedor_escolhido(
    env: pytest.MonkeyPatch, agent_model: str, key: str, value: str | None, load
) -> None:
    env.setenv("AGENT_MODEL", agent_model)
    if value is not None:
        env.setenv(key, value)

    with pytest.raises(ConfigError, match=key):
        load()


@pytest.mark.parametrize(
    ("agent_model", "key"),
    [
        ("openai/gpt-x", "OPENAI_API_KEY"),
        ("anthropic/claude-x", "ANTHROPIC_API_KEY"),
    ],
)
def test_aceita_a_chave_do_provedor_escolhido(
    env: pytest.MonkeyPatch, agent_model: str, key: str
) -> None:
    env.setenv("AGENT_MODEL", agent_model)
    env.setenv(key, "sk-teste")

    assert load_settings().agent_model == agent_model


def test_os_padroes_do_banco_de_negocio(env: pytest.MonkeyPatch) -> None:
    settings = load_settings()

    assert settings.business_database_url == REQUIRED["BUSINESS_DATABASE_URL"]
    assert settings.business_time_zone == "America/Sao_Paulo"
    assert settings.business_query_timeout_ms == 3000


def test_a_carga_exige_a_url_do_dono(env: pytest.MonkeyPatch) -> None:
    with pytest.raises(ConfigError, match="BUSINESS_OWNER_DATABASE_URL"):
        load_business_load_settings()


def test_a_carga_le_a_url_do_dono(env: pytest.MonkeyPatch) -> None:
    env.setenv(
        "BUSINESS_OWNER_DATABASE_URL",
        "postgresql+asyncpg://business:x@postgres/business",
    )

    settings = load_business_load_settings()

    assert settings.business_owner_database_url.startswith(
        "postgresql+asyncpg://business:"
    )
