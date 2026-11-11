"""Registro de Agentes conectados no Banco dos agentes: existir a linha é estar conectado."""

from __future__ import annotations

from sqlalchemy import Column, DateTime, MetaData, Table, Text, func, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncEngine

# Os metadados das tabelas do projeto: o Alembic gera e aplica só estas, e nunca as de sessão do
# ADK, que o próprio ADK cria e mantém.
REGISTRY_METADATA = MetaData()

connected_agents = Table(
    "connected_agents",
    REGISTRY_METADATA,
    Column("slug", Text, primary_key=True),
    # A Pessoa que conectou, para diagnóstico; sem chave estrangeira, porque ela está no Banco do
    # chat.
    Column("connected_by", UUID(as_uuid=True), nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    Column(
        "updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)


def include_registry_object(obj, name, type_, reflected, compare_to) -> bool:
    """O `include_object` do Alembic: só o que está nos metadados do registro, e nunca as tabelas
    de sessão do ADK."""
    if type_ == "table":
        return name in REGISTRY_METADATA.tables
    table = getattr(obj, "table", None)
    return table is None or table.name in REGISTRY_METADATA.tables


async def connected_slugs(engine: AsyncEngine) -> set[str]:
    async with engine.connect() as connection:
        result = await connection.execute(select(connected_agents.c.slug))
        return {row.slug for row in result}
