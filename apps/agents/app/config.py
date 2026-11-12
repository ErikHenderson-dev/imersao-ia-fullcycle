"""Configuração do Serviço de agentes (spec da F10, "Registro de Agentes").

Valida e tipa as variáveis de ambiente do projeto numa peça só. Uma variável obrigatória ausente
faz a subida falhar com o nome dela.
"""

from __future__ import annotations

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigError(Exception):
    """A configuração do ambiente está incompleta ou inválida."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

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


def load_settings() -> Settings:
    """Lê a configuração do ambiente, com o nome da variável que faltar no erro."""
    try:
        settings = Settings()
    except ValidationError as error:
        names = ", ".join(
            str(issue["loc"][0]).upper() for issue in error.errors() if issue["loc"]
        )
        raise ConfigError(
            f"Variável de ambiente obrigatória ausente ou inválida: {names}"
        ) from error
    if not settings.agents_service_token.strip():
        raise ConfigError(
            "Variável de ambiente obrigatória ausente ou inválida: AGENTS_SERVICE_TOKEN"
        )
    return settings
