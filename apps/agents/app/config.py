"""Configuração do Serviço de agentes (spec da F10, "Registro de Agentes"; spec da F11, "Modelo de IA").

Valida e tipa as variáveis de ambiente do projeto numa peça só. Uma variável obrigatória ausente
faz a subida falhar com o nome dela.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import PositiveInt, StringConstraints, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

Provider = Literal["gemini", "openai", "anthropic"]

# A chave que cada provedor do LiteLlm exige; a do Gemini segue opcional (LLD, "Ambiente de
# desenvolvimento", "Chave do modelo no Serviço de agentes").
PROVIDER_KEYS: dict[Provider, str] = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}


# O fuso da empresa (LLD, "Valores e configuração", "Fuso da empresa").
DEFAULT_BUSINESS_TIME_ZONE = "America/Sao_Paulo"
# O tempo limite da consulta ao Banco de negócio, em milissegundos (LLD, "Valores e configuração").
DEFAULT_BUSINESS_QUERY_TIMEOUT_MS = 3000

# Um segredo ou endereço obrigatório: só espaços conta como ausente.
Required = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


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
        prefix, _, name = self.agent_model.partition("/")
        # openai/ sem o nome do modelo falharia só na primeira chamada ao provedor.
        if prefix in PROVIDER_KEYS and name.strip():
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
    agents_service_token: Required
    # A API do chat pela rede interna e a credencial de bot das rotas /v1/bot (spec da F11,
    # "Execução do Pedido").
    chat_api_url: Required
    chat_bot_token: Required
    # O Redis do limite de pedidos por Pessoa, e o limite por minuto (spec da F11, "Rota de
    # Pedido"; LLD, "Valores e configuração").
    redis_url: Required
    agent_requests_per_minute: PositiveInt = 10
    # O Banco de negócio pelo usuário só leitura (spec da F13, "Ambiente de desenvolvimento"; ADR
    # 0013), o fuso da empresa e o tempo limite da consulta (LLD, "Valores e configuração").
    business_database_url: Required
    business_time_zone: Required = DEFAULT_BUSINESS_TIME_ZONE
    business_query_timeout_ms: PositiveInt = DEFAULT_BUSINESS_QUERY_TIMEOUT_MS
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


class WorkerConfig(BaseSettings):
    """O Worker de agentes (spec da F14, "Worker de agentes"): sem a chave do modelo, sem a credencial
    de bot e sem as sessões do ADK, porque ele nunca chama o modelo."""

    model_config = SettingsConfigDict(extra="ignore")

    # A auditoria, no Banco dos agentes.
    database_url: Required
    # A API do chat e a credencial do Worker, aceita só na entrega e na falha do Relatório.
    chat_api_url: Required
    chat_worker_token: Required
    # A fila e a trava do Relatório.
    redis_url: Required
    business_database_url: Required
    business_time_zone: Required = DEFAULT_BUSINESS_TIME_ZONE
    business_query_timeout_ms: PositiveInt = DEFAULT_BUSINESS_QUERY_TIMEOUT_MS
    # O armazenamento de objetos do PDF, pelo endereço interno, com acesso por caminho; com
    # `s3_create_bucket`, só no desenvolvimento, o Worker cria o bucket na subida.
    s3_endpoint: Required
    s3_bucket: Required
    s3_access_key_id: Required
    s3_secret_access_key: Required
    s3_create_bucket: bool = False


def load_worker_settings() -> WorkerConfig:
    """A configuração do Worker, conferida na subida dele."""
    return _read(WorkerConfig)


class BusinessLoadSettings(BaseSettings):
    """A carga do Banco de negócio, que só o script lê: a credencial do dono fica fora do app."""

    model_config = SettingsConfigDict(extra="ignore")

    business_owner_database_url: Required


def load_business_load_settings() -> BusinessLoadSettings:
    """A URL do dono do Banco de negócio, com o nome da variável no erro quando falta."""
    return _read(BusinessLoadSettings)


def _read[T: BaseSettings](cls: type[T]) -> T:
    """Lê a configuração do ambiente, com o nome da variável que faltar no erro."""
    try:
        settings = cls()
    except ValidationError as error:
        raise _missing(
            *(str(issue["loc"][0]).upper() for issue in error.errors() if issue["loc"])
        ) from error
    if isinstance(settings, ModelSettings):
        settings.check_model()
    return settings


def load_model_settings() -> ModelSettings:
    """Só o modelo, para o agent.py não exigir o banco nem a credencial de serviço."""
    return _read(ModelSettings)


def load_settings() -> Settings:
    """A configuração inteira, conferida na subida do app HTTP."""
    return _read(Settings)
