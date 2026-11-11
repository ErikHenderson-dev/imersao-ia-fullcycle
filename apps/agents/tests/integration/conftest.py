"""Banco e app dos testes de integração do registro (F10-T04, CA6).

O `agents_test` é apagado, criado de novo e migrado uma vez por execução, como o `chat_test` da
API do chat: conectado como o superusuário local, porque o papel `agents` não tem CREATEDB.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import threading
import uuid
from collections.abc import AsyncIterator, Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import asyncpg
import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings

PROJECT_DIR = Path(__file__).resolve().parents[2]
SERVICE_TOKEN = "segredo-dos-testes"
BOT_TOKEN = "credencial-de-bot-dos-testes"
# Ninguém escuta aqui: os testes que não chegam à API do chat não precisam dela.
NO_CHAT_API = "http://127.0.0.1:9"


async def _recreate_database(admin_url: str, name: str) -> None:
    admin = await asyncpg.connect(admin_url)
    try:
        await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.execute(f'CREATE DATABASE "{name}" OWNER agents')
        await admin.execute(f'REVOKE CONNECT ON DATABASE "{name}" FROM PUBLIC')
        await admin.execute(f'GRANT CONNECT ON DATABASE "{name}" TO agents')
    finally:
        await admin.close()


@pytest.fixture(scope="session")
def test_database_url() -> Iterator[str]:
    url = os.environ.get("TEST_DATABASE_URL")
    admin_url = os.environ.get("TEST_DATABASE_ADMIN_URL")
    if not url or not admin_url:
        raise RuntimeError(
            "TEST_DATABASE_URL e TEST_DATABASE_ADMIN_URL são obrigatórias"
        )
    asyncio.run(_recreate_database(admin_url, urlparse(url).path.lstrip("/")))
    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=PROJECT_DIR,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
    )
    yield url


def settings_for(
    url: str, *, adk_dev_routes: bool, chat_api_url: str = NO_CHAT_API
) -> Settings:
    return Settings(
        database_url=url,
        agents_service_token=SERVICE_TOKEN,
        agent_model="gemini-3.8-flash",
        adk_dev_routes=adk_dev_routes,
        chat_api_url=chat_api_url,
        chat_bot_token=BOT_TOKEN,
        # Sessões do ADK em memória: os testes não gravam no banco de desenvolvimento.
        session_service_uri=None,
    )


async def _client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://agents"
        ) as client:
            yield client


@pytest_asyncio.fixture
async def client(test_database_url: str) -> AsyncIterator[httpx.AsyncClient]:
    """O app de produção: sem as rotas genéricas do ADK."""
    from app.fast_api_app import create_app

    async for client in _client(
        create_app(settings_for(test_database_url, adk_dev_routes=False))
    ):
        yield client


@pytest_asyncio.fixture
async def dev_client(test_database_url: str) -> AsyncIterator[httpx.AsyncClient]:
    """O app de desenvolvimento: com as rotas genéricas do ADK."""
    from app.fast_api_app import create_app

    async for client in _client(
        create_app(settings_for(test_database_url, adk_dev_routes=True))
    ):
        yield client


@pytest_asyncio.fixture
async def engine(client: httpx.AsyncClient) -> AsyncEngine:
    transport = client._transport
    assert isinstance(transport, httpx.ASGITransport)
    return transport.app.state.engine


@pytest_asyncio.fixture
async def clean_registry(engine: AsyncEngine) -> None:
    async with engine.begin() as connection:
        await connection.execute(text("DELETE FROM connected_agents"))


class FakeChatApi:
    """A API do chat falsa, num servidor temporário em 127.0.0.1: guarda cada requisição; responde
    201 com uma Mensagem qualquer às ações (F11-T03) e 200 com `conversation` à leitura do Recorte
    (F11-T04)."""

    def __init__(self) -> None:
        self.requests: list[dict] = []
        # A leitura devolve estas Mensagens, no formato da rota, como estão.
        self.conversation: list[dict] = []
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                url = urlparse(self.path)
                fake.requests.append(
                    {
                        "method": "GET",
                        "path": url.path,
                        "query": {
                            key: values[0]
                            for key, values in parse_qs(url.query).items()
                        },
                        "authorization": self.headers.get("authorization"),
                    }
                )
                payload = json.dumps(
                    {"messages": fake.conversation, "total": len(fake.conversation)}
                ).encode()
                self.send_response(200)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def do_POST(self) -> None:
                length = int(self.headers.get("content-length") or 0)
                fake.requests.append(
                    {
                        "method": "POST",
                        "path": self.path,
                        "authorization": self.headers.get("authorization"),
                        "body": json.loads(self.rfile.read(length) or b"null"),
                    }
                )
                payload = json.dumps({"message": {"id": str(uuid.uuid4())}}).encode()
                self.send_response(201)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, format: str, *args: object) -> None:
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def fake_chat_api() -> Iterator[FakeChatApi]:
    fake = FakeChatApi()
    yield fake
    fake.close()


@pytest_asyncio.fixture
async def request_client(
    test_database_url: str, fake_chat_api: FakeChatApi
) -> AsyncIterator[httpx.AsyncClient]:
    """O app de produção, falando com a API do chat falsa."""
    from app.fast_api_app import create_app

    async for client in _client(
        create_app(
            settings_for(
                test_database_url, adk_dev_routes=False, chat_api_url=fake_chat_api.url
            )
        )
    ):
        yield client
