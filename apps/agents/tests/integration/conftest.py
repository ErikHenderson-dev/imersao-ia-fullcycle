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
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

import asyncpg
import boto3
import httpx
import pytest
import pytest_asyncio
from botocore.config import Config
from fastapi import FastAPI
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.business.db import BusinessStore, business_engine
from app.chat_api import ChatApiClient
from app.config import Settings
from app.registry.store import connect, disconnect
from app.worker.job import WorkerDeps
from app.worker.storage import ReportStorage

PROJECT_DIR = Path(__file__).resolve().parents[2]
SERVICE_TOKEN = "segredo-dos-testes"
BOT_TOKEN = "credencial-de-bot-dos-testes"
# Ninguém escuta aqui: os testes que não chegam à API do chat não precisam dela.
NO_CHAT_API = "http://127.0.0.1:9"


async def _recreate_database(
    admin_url: str, name: str, owner: str = "agents", readers: tuple[str, ...] = ()
) -> None:
    """Recria o banco com o dono dado; os `readers` conectam e leem as tabelas que o dono criar,
    como o `business_readonly` no init (docker/postgres/init)."""
    admin = await asyncpg.connect(admin_url)
    try:
        await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.execute(f'CREATE DATABASE "{name}" OWNER {owner}')
        await admin.execute(f'REVOKE CONNECT ON DATABASE "{name}" FROM PUBLIC')
        await admin.execute(
            f'GRANT CONNECT ON DATABASE "{name}" TO {", ".join((owner, *readers))}'
        )
    finally:
        await admin.close()
    if not readers:
        return
    database = await asyncpg.connect(_with_database(admin_url, name))
    try:
        for reader in readers:
            await database.execute(f"GRANT USAGE ON SCHEMA public TO {reader}")
            await database.execute(
                f"ALTER DEFAULT PRIVILEGES FOR ROLE {owner} IN SCHEMA public "
                f"GRANT SELECT ON TABLES TO {reader}"
            )
    finally:
        await database.close()


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


def _with_database(url: str, name: str) -> str:
    return urlparse(url)._replace(path=f"/{name}").geturl()


@pytest.fixture(scope="session")
def business_test_database_url() -> Iterator[str]:
    """A URL do usuário só leitura no `business_test`, recriado uma vez por execução (F13-T03)."""
    url = os.environ.get("BUSINESS_TEST_DATABASE_URL")
    admin_url = os.environ.get("TEST_DATABASE_ADMIN_URL")
    if not url or not admin_url:
        raise RuntimeError(
            "BUSINESS_TEST_DATABASE_URL e TEST_DATABASE_ADMIN_URL são obrigatórias"
        )
    asyncio.run(
        _recreate_database(
            admin_url,
            urlparse(url).path.lstrip("/"),
            owner="business",
            readers=("business_readonly",),
        )
    )
    yield url


@pytest.fixture(scope="session")
def business_test_admin_url(business_test_database_url: str) -> str:
    """O superusuário no `business_test`, pelo SQLAlchemy assíncrono: a carga roda com
    `SET ROLE business`."""
    admin_url = os.environ["TEST_DATABASE_ADMIN_URL"]
    name = urlparse(business_test_database_url).path.lstrip("/")
    return _with_database(admin_url, name).replace(
        "postgresql://", "postgresql+asyncpg://", 1
    )


@pytest.fixture(scope="session")
def loaded_business_test(business_test_admin_url: str) -> str:
    """O `business_test` carregado com os dados fixos, uma vez por execução, como o dono; devolve a
    URL do usuário só leitura (F13-T04)."""
    from sqlalchemy.ext.asyncio import create_async_engine

    from app.business.load import load

    async def run() -> None:
        engine = create_async_engine(business_test_admin_url)
        try:
            async with engine.begin() as connection:
                await connection.execute(text("SET LOCAL ROLE business"))
                await load(connection)
        finally:
            await engine.dispose()

    asyncio.run(run())
    return os.environ["BUSINESS_TEST_DATABASE_URL"]


def settings_for(
    url: str,
    *,
    adk_dev_routes: bool,
    chat_api_url: str = NO_CHAT_API,
    redis_url: str | None = None,
) -> Settings:
    return Settings(
        database_url=url,
        agents_service_token=SERVICE_TOKEN,
        agent_model="gemini-3.8-flash",
        adk_dev_routes=adk_dev_routes,
        chat_api_url=chat_api_url,
        chat_bot_token=BOT_TOKEN,
        # O banco lógico do Redis dos testes (TEST_REDIS_URL no compose.yaml).
        redis_url=redis_url or redis_url_for_tests(),
        # Sessões do ADK em memória: os testes não gravam no banco de desenvolvimento.
        session_service_uri=None,
        # O Banco de negócio de teste, pelo usuário só leitura (F13-T03).
        business_database_url=os.environ.get("BUSINESS_TEST_DATABASE_URL", ""),
    )


def redis_url_for_tests() -> str:
    url = os.environ.get("TEST_REDIS_URL")
    if not url:
        raise RuntimeError("TEST_REDIS_URL é obrigatória")
    return url


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
    (F11-T04). `failures` faz a rota cujo caminho termina com a chave responder, na ordem, os
    status da lista, um por chamada (F11-T06), ou o par (status, code) da recusa (F12-T01). As contagens respondem `counts`, um número por `since`,
    e `total` (F11-T07)."""

    def __init__(self) -> None:
        self.requests: list[dict] = []
        # A leitura devolve estas Mensagens, no formato da rota, como estão.
        self.conversation: list[dict] = []
        self.failures: dict[str, list[int | tuple[int, str]]] = {}
        self.counts: list[int] = [4, 6, 9]
        self.total = 15
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def respond(self, path: str, status: int, payload: dict) -> None:
                for suffix, statuses in fake.failures.items():
                    if path.endswith(suffix) and statuses:
                        failure = statuses.pop(0)
                        # Um status sozinho, ou o par (status, code) da recusa (F12-T01).
                        status, code = (
                            failure
                            if isinstance(failure, tuple)
                            else (failure, "falha_do_teste")
                        )
                        payload = {"code": code}
                body = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self) -> None:
                url = urlparse(self.path)
                query = parse_qs(url.query)
                fake.requests.append(
                    {
                        "method": "GET",
                        "path": url.path,
                        "query": {key: values[0] for key, values in query.items()},
                        "query_all": query,
                        "authorization": self.headers.get("authorization"),
                    }
                )
                if url.path.endswith("/message-counts"):
                    sinces = query.get("since", [])
                    payload = {
                        "counts": [
                            {"since": since, "count": count}
                            for since, count in zip(sinces, fake.counts, strict=False)
                        ],
                        "total": fake.total,
                    }
                else:
                    payload = {
                        "messages": fake.conversation,
                        "total": len(fake.conversation),
                    }
                self.respond(url.path, 200, payload)

            def do_POST(self) -> None:
                length = int(self.headers.get("content-length") or 0)
                fake.requests.append(
                    {
                        "method": "POST",
                        "path": self.path,
                        # O instante da chamada: o Worker audita antes de entregar (F14-T03).
                        "received_at": datetime.now(UTC),
                        "authorization": self.headers.get("authorization"),
                        "body": json.loads(self.rfile.read(length) or b"null"),
                    }
                )
                self.respond(self.path, 201, {"message": {"id": str(uuid.uuid4())}})

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


async def set_assistant_connected(client: httpx.AsyncClient, connected: bool) -> None:
    """O `assistente` conectado ou não no registro do `agents_test` (F11-T06: a rota de Pedido
    confere a conexão)."""
    transport = client._transport
    assert isinstance(transport, httpx.ASGITransport)
    engine = transport.app.state.engine
    if connected:
        await connect(engine, "assistente", uuid.uuid4())
    else:
        await disconnect(engine, "assistente")


@pytest_asyncio.fixture
async def connected_assistant(request_client: httpx.AsyncClient) -> None:
    await set_assistant_connected(request_client, True)


@asynccontextmanager
async def app_client(settings: Settings) -> AsyncIterator[httpx.AsyncClient]:
    """Um app de produção com a configuração que o teste pede (F11-T06)."""
    from app.fast_api_app import create_app

    async for client in _client(create_app(settings)):
        yield client


def s3_client():
    """O S3 do contêiner, pelo endereço interno, como o Worker o acessa (F14-T03)."""
    return boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT"],
        aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
        region_name="us-east-1",
        config=Config(s3={"addressing_style": "path"}),
    )


# O Banco dos agentes de teste, para a auditoria (F13-T04 e F14).
@pytest_asyncio.fixture(loop_scope="session")
async def agents_engine(test_database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(test_database_url)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def redis() -> AsyncIterator[Redis]:
    client = Redis.from_url(redis_url_for_tests(), decode_responses=True)
    yield client
    await client.aclose()


# As dependências do Worker de agentes (F14-T03): o Banco de negócio de teste, a auditoria, a API do
# chat falsa com a credencial do Worker, o S3 do contêiner e o Redis de teste.
@pytest_asyncio.fixture(loop_scope="session")
async def deps(
    loaded_business_test: str,
    agents_engine: AsyncEngine,
    fake_chat_api: FakeChatApi,
    redis: Redis,
) -> AsyncIterator[WorkerDeps]:
    storage = ReportStorage(s3_client(), os.environ["S3_BUCKET"])
    await storage.ensure_bucket()
    business = BusinessStore(
        business=business_engine(loaded_business_test, 3000),
        agents=agents_engine,
        time_zone=ZoneInfo("America/Sao_Paulo"),
    )
    chat = ChatApiClient(fake_chat_api.url, "credencial-do-worker")
    yield WorkerDeps(business=business, chat=chat, storage=storage, redis=redis)
    await chat.close()
    await business.dispose()
