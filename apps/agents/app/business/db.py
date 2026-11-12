"""O acesso da ferramenta de consulta ao Banco de negócio e à auditoria (spec da F13, "Catálogo e
consulta").

O motor do Banco de negócio usa o usuário só leitura (`BUSINESS_DATABASE_URL`, ADR 0013), com o
`statement_timeout` igual ao `tempo limite da consulta ao Banco de negócio`, definido na conexão. A
ferramenta o recebe por um ContextVar, como a API do chat, posto pela execução do Pedido.
"""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import Row, Select
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.business import audit
from app.config import Settings


@dataclass(frozen=True)
class BusinessStore:
    business: AsyncEngine
    # O Banco dos agentes, onde mora a auditoria.
    agents: AsyncEngine
    time_zone: ZoneInfo

    async def record(self, **fields: Any) -> None:
        """Grava a linha de auditoria da consulta no Banco dos agentes (`audit.record`)."""
        await audit.record(self.agents, **fields)

    async def fetch_one(self, statement: Select) -> Row:
        async with self.business.connect() as connection:
            return (await connection.execute(statement)).one()

    async def dispose(self) -> None:
        await self.business.dispose()


def business_engine(url: str, timeout_ms: int) -> AsyncEngine:
    return create_async_engine(
        url,
        pool_pre_ping=True,
        connect_args={"server_settings": {"statement_timeout": str(timeout_ms)}},
    )


def build_business_store(
    settings: Settings, agents_engine: AsyncEngine
) -> BusinessStore:
    return BusinessStore(
        business=business_engine(
            settings.business_database_url, settings.business_query_timeout_ms
        ),
        agents=agents_engine,
        time_zone=ZoneInfo(settings.business_time_zone),
    )


CURRENT_BUSINESS: ContextVar[BusinessStore | None] = ContextVar(
    "CURRENT_BUSINESS", default=None
)
