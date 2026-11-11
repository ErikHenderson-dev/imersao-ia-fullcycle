"""Rotas /v1 do registro de Agentes e os dois jeitos de montar o app (F10-T04)."""

from __future__ import annotations

import uuid

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

# O segredo do app dos testes (conftest.py).
SERVICE_TOKEN = "segredo-dos-testes"
AUTH = {"Authorization": f"Bearer {SERVICE_TOKEN}"}

# Mesmo laço das fixtures (asyncio_default_fixture_loop_scope = "session" no pyproject).
pytestmark = pytest.mark.asyncio(loop_scope="session")


async def connect_row(engine: AsyncEngine, slug: str) -> None:
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "INSERT INTO connected_agents (slug, connected_by) VALUES (:slug, :by)"
            ),
            {"slug": slug, "by": uuid.uuid4()},
        )


async def test_a_migracao_cria_connected_agents(engine: AsyncEngine) -> None:
    async with engine.connect() as connection:
        result = await connection.execute(
            text(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
                "WHERE table_name = 'connected_agents' ORDER BY ordinal_position"
            )
        )
        columns = [tuple(row) for row in result]

    assert columns == [
        ("slug", "text", "NO"),
        ("connected_by", "uuid", "NO"),
        ("created_at", "timestamp with time zone", "NO"),
        ("updated_at", "timestamp with time zone", "NO"),
    ]


async def test_lista_o_catalogo_desconectado(
    client: httpx.AsyncClient, clean_registry: None
) -> None:
    response = await client.get("/v1/agents", headers=AUTH)

    assert response.status_code == 200
    agents = response.json()["agents"]
    assert {
        "slug": "assistente",
        "name": "Assistente",
        "username": "assistente",
        "description": (
            "Resume conversas, delega tarefas para quem você mencionar e responde "
            "perguntas sobre os dados do negócio."
        ),
        "connected": False,
    } in agents
    names = [agent["name"] for agent in agents]
    assert names == sorted(names, key=str.casefold)


async def test_traz_connected_e_ignora_slug_fora_do_catalogo(
    client: httpx.AsyncClient, engine: AsyncEngine, clean_registry: None
) -> None:
    await connect_row(engine, "assistente")
    await connect_row(engine, "agente-removido")

    response = await client.get("/v1/agents", headers=AUTH)

    assert response.status_code == 200
    by_slug = {agent["slug"]: agent for agent in response.json()["agents"]}
    assert by_slug["assistente"]["connected"] is True
    assert "agente-removido" not in by_slug


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": SERVICE_TOKEN},
        {"Authorization": f"Basic {SERVICE_TOKEN}"},
        {"Authorization": "Bearer segredo-errado"},
        {"Authorization": "Bearer "},
    ],
)
async def test_responde_401_sem_a_credencial_certa(
    client: httpx.AsyncClient, headers: dict[str, str]
) -> None:
    response = await client.get("/v1/agents", headers=headers)

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json() == {
        "type": "about:blank",
        "title": "Unauthorized",
        "status": 401,
        "detail": "Credencial de serviço ausente ou inválida.",
        "code": "unauthorized",
    }


async def test_sem_as_rotas_do_adk(client: httpx.AsyncClient) -> None:
    run = await client.post("/run", json={})
    list_apps = await client.get("/list-apps")
    health = await client.get("/health")
    agents = await client.get("/v1/agents", headers=AUTH)

    assert run.status_code == 404
    assert list_apps.status_code == 404
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}
    assert agents.status_code == 200


async def test_com_as_rotas_do_adk(dev_client: httpx.AsyncClient) -> None:
    list_apps = await dev_client.get("/list-apps")
    agents = await dev_client.get("/v1/agents", headers=AUTH)
    unauthorized = await dev_client.get("/v1/agents")

    assert list_apps.status_code == 200
    assert "assistente" in list_apps.json()
    assert agents.status_code == 200
    assert unauthorized.status_code == 401
