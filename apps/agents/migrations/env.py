"""Ambiente do Alembic: só as tabelas do registro, e nunca as de sessão do ADK."""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.registry.store import REGISTRY_METADATA, include_registry_object

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = REGISTRY_METADATA


include_object = include_registry_object


def database_url() -> str:
    # Só o DATABASE_URL: as migrações não precisam do resto da configuração do app.
    import os

    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Variável de ambiente obrigatória ausente: DATABASE_URL")
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(database_url())
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
