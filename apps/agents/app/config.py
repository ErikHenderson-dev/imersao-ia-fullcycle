"""Configuração do Serviço de agentes (spec da F10, "Registro de Agentes"; spec da F11, "Modelo de IA").

Valida e tipa as variáveis de ambiente do projeto numa peça só. Uma variável obrigatória ausente
faz a subida falhar com o nome dela.
"""

from __future__ import annotations

from typing import Literal

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

Provider = Literal["gemini", "openai", "anthropic"]

# A chave que cada provedor do LiteLlm exige; a do Gemini segue opcional (LLD, "Ambiente de
# desenvolvimento", "Chave do modelo no Serviço de agentes").
PROVIDER_KEYS: dict[Provider, str] = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}


class ConfigError(Exception):
    """A configuração do ambiente está incompleta ou inválida."""


def _missing(*names: str) -> ConfigError:
    return ConfigError(
        f"Variável de ambiente obrigatória ausente ou inválida: {', '.join(names)}"
    )


class ModelSettings(BaseSettings):
    """O modelo dos Agentes, lido também pelo agent.py fora do app HTTP (adk run, adk eval)."""

    model_config = SettingsConfigDict(extra="ignore")

    # gemini-… usa o Gemini nativo do ADK; openai/… e anthropic/…, o LiteLlm.
    agent_model: str
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None

    @property
    def provider(self) -> Provider:
        """O provedor pelo prefixo do AGENT_MODEL."""
        if self.agent_model.startswith("gemini") and "/" not in self.agent_model:
            return "gemini"
        prefix = self.agent_model.split("/", 1)[0]
        if prefix in PROVIDER_KEYS:
            return prefix
        raise _missing("AGENT_MODEL")

    @property
    def provider_api_key(self) -> str | None:
        """A chave do provedor escolhido, ou nenhuma para o Gemini."""
        return {
            "openai": self.openai_api_key,
            "anthropic": self.anthropic_api_key,
        }.get(self.provider)

    def check_model(self) -> None:
        """Falha com o nome da variável quando o provedor é desconhecido ou está sem chave."""
        provider = self.provider
        if provider in PROVIDER_KEYS and not (self.provider_api_key or "").strip():
            raise _missing(PROVIDER_KEYS[provider])


class Settings(ModelSettings):
    # Conexão do registro e do Alembic com o Banco dos agentes (postgresql+asyncpg://).
    database_url: str
    # Credencial de serviço que as rotas /v1 conferem.
    agents_service_token: str
    # true liga as rotas genéricas do ADK e a interface web, só no desenvolvimento.
    adk_dev_routes: bool = False
    # Lidas também pelo código gerado (app_utils/services.py e fast_api_app.py).
    session_service_uri: str | None = None
    allow_origins: str | None = None

    @property
    def allow_origins_list(self) -> list[str] | None:
        """ALLOW_ORIGINS separada por vírgula, ou nenhuma origem extra."""
        if not self.allow_origins:
            return None
        return [
            origin.strip() for origin in self.allow_origins.split(",") if origin.strip()
        ]


def _read[T: ModelSettings](cls: type[T]) -> T:
    """Lê a configuração do ambiente, com o nome da variável que faltar no erro."""
    try:
        settings = cls()
    except ValidationError as error:
        raise _missing(
            *(str(issue["loc"][0]).upper() for issue in error.errors() if issue["loc"])
        ) from error
    settings.check_model()
    return settings


def load_model_settings() -> ModelSettings:
    """Só o modelo, para o agent.py não exigir o banco nem a credencial de serviço."""
    return _read(ModelSettings)


def load_settings() -> Settings:
    """A configuração inteira, conferida na subida do app HTTP."""
    settings = _read(Settings)
    if not settings.agents_service_token.strip():
        raise _missing("AGENTS_SERVICE_TOKEN")
    return settings
