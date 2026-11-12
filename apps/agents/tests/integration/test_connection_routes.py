"""Conectar e desconectar um Agente: PUT e DELETE /v1/agents/{slug}/connection (F10-T06 e T07)."""

from __future__ import annotations

import uuid

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

# O segredo do app dos testes (conftest.py).
AUTH = {"Authorization": "Bearer segredo-dos-testes"}

# Mesmo laço das fixtures (asyncio_default_fixture_loop_scope = "session" no pyproject).
pytestmark = pytest.mark.asyncio(loop_scope="session")

METHODS = pytest.mark.parametrize("method", ["PUT", "DELETE"])


def body(is_admin: bool = True, person_id: uuid.UUID | None = None) -> dict:
    return {"person_id": str(person_id or uuid.uuid4()), "is_admin": is_admin}


async def connected_by(engine: AsyncEngine, slug: str) -> uuid.UUID | None:
    async with engine.connect() as connection:
        result = await connection.execute(
            text("SELECT connected_by FROM connected_agents WHERE slug = :slug"),
            {"slug": slug},
        )
        return result.scalar_one_or_none()


async def test_conecta_e_aparece_conectado(
    client: httpx.AsyncClient, clean_registry: None
) -> None:
    response = await client.put(
        "/v1/agents/assistente/connection", json=body(), headers=AUTH
    )

    assert response.status_code == 204
    agents = (await client.get("/v1/agents", headers=AUTH)).json()["agents"]
    assert next(a for a in agents if a.get("slug") == "assistente")["connected"] is True


async def test_conectar_de_novo_responde_204_sem_mudar_quem_conectou(
    client: httpx.AsyncClient, engine: AsyncEngine, clean_registry: None
) -> None:
    first = uuid.uuid4()
    await client.put(
        "/v1/agents/assistente/connection", json=body(person_id=first), headers=AUTH
    )

    response = await client.put(
        "/v1/agents/assistente/connection", json=body(), headers=AUTH
    )

    assert response.status_code == 204
    assert await connected_by(engine, "assistente") == first


@METHODS
async def test_responde_401_sem_a_credencial_antes_do_corpo(
    client: httpx.AsyncClient, method: str
) -> None:
    response = await client.request(method, "/v1/agents/assistente/connection", json={})

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


@METHODS
@pytest.mark.parametrize("slug", ["assistente", "agente-que-nao-existe"])
async def test_responde_403_sem_is_admin_antes_do_catalogo(
    client: httpx.AsyncClient,
    engine: AsyncEngine,
    clean_registry: None,
    slug: str,
    method: str,
) -> None:
    response = await client.request(
        method, f"/v1/agents/{slug}/connection", json=body(is_admin=False), headers=AUTH
    )

    assert response.status_code == 403
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "forbidden"
    assert await connected_by(engine, slug) is None


@METHODS
async def test_responde_404_fora_do_catalogo(
    client: httpx.AsyncClient, clean_registry: None, method: str
) -> None:
    response = await client.request(
        method, "/v1/agents/agente-que-nao-existe/connection", json=body(), headers=AUTH
    )

    assert response.status_code == 404
    assert response.json()["code"] == "agent_not_found"


@pytest.mark.parametrize(
    "payload",
    [
        {"is_admin": True},
        {"person_id": "nao-e-uuid", "is_admin": True},
        {"person_id": str(uuid.uuid4())},
        {"person_id": str(uuid.uuid4()), "is_admin": "sim"},
    ],
)
@METHODS
async def test_responde_400_com_o_corpo_invalido(
    client: httpx.AsyncClient, payload: dict, method: str
) -> None:
    response = await client.request(
        method, "/v1/agents/assistente/connection", json=payload, headers=AUTH
    )

    assert response.status_code == 400
    assert response.json()["code"] == "validation_failed"


async def test_desconecta_e_repetido_responde_204(
    client: httpx.AsyncClient, engine: AsyncEngine, clean_registry: None
) -> None:
    await client.put("/v1/agents/assistente/connection", json=body(), headers=AUTH)

    first = await client.request(
        "DELETE", "/v1/agents/assistente/connection", json=body(), headers=AUTH
    )
    again = await client.request(
        "DELETE", "/v1/agents/assistente/connection", json=body(), headers=AUTH
    )

    assert first.status_code == 204
    assert again.status_code == 204
    assert await connected_by(engine, "assistente") is None
