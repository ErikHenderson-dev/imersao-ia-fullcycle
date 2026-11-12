"""A auditoria das consultas ao Banco de negócio (spec da F13, "Auditoria"; HLD, seção 3).

Uma linha por chamada da ferramenta de consulta, no Banco dos agentes, gravada antes de a resposta
ir à API do chat, e nunca o resultado. A tabela entra nos metadados do Banco dos agentes, que o
Alembic gera e aplica.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any, Literal

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Index,
    Table,
    Text,
    func,
    insert,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncEngine

from app.registry.store import REGISTRY_METADATA

Outcome = Literal[
    "answered",
    "no_permission",
    "not_found",
    "ambiguous_name",
    "too_generic",
    "lastro_blocked",
    "error",
]

business_queries = Table(
    "business_queries",
    REGISTRY_METADATA,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("request_id", UUID(as_uuid=True), nullable=False),
    Column("requester_id", UUID(as_uuid=True), nullable=False),
    Column("conversation_id", UUID(as_uuid=True), nullable=False),
    Column("question", Text, nullable=False),
    Column("params", JSONB, nullable=True),
    Column("sql", Text, nullable=True),
    Column("outcome", Text, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    CheckConstraint(
        "outcome IN ('answered', 'no_permission', 'not_found', 'ambiguous_name', "
        "'too_generic', 'lastro_blocked', 'error')",
        name="business_queries_outcome_check",
    ),
    Index("business_queries_request_id_idx", "request_id"),
)


def uuid7() -> uuid.UUID:
    """Um UUID v7 (ADR 0022): 48 bits de milissegundos e o resto aleatório."""
    value = (time.time_ns() // 1_000_000) << 80 | int.from_bytes(os.urandom(10))
    value = (value & ~(0xF << 76)) | (0x7 << 76)
    value = (value & ~(0x3 << 62)) | (0x2 << 62)
    return uuid.UUID(int=value)


async def record(
    engine: AsyncEngine,
    *,
    request_id: str,
    requester_id: str,
    conversation_id: str,
    question: str,
    params: dict[str, Any] | None,
    sql: str | None,
    outcome: Outcome,
) -> None:
    """Grava a linha da consulta; a falha sobe, e o Pedido termina em "não consegui"."""
    async with engine.begin() as connection:
        await connection.execute(
            insert(business_queries).values(
                id=uuid7(),
                request_id=uuid.UUID(request_id),
                requester_id=uuid.UUID(requester_id),
                conversation_id=uuid.UUID(conversation_id),
                question=question,
                params=params,
                sql=sql,
                outcome=outcome,
            )
        )
