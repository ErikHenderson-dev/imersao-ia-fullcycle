"""O Worker de agentes (spec da F14, "Worker de agentes"; ADR 0006): consome a fila dos Pedidos
demorados e gera o Relatório em PDF, sem chamar o modelo.

Roda com `uv run arq app.worker.WorkerSettings`, na mesma imagem do Serviço de agentes.
"""

from __future__ import annotations

import os
from typing import Any, ClassVar
from zoneinfo import ZoneInfo

from arq.connections import RedisSettings
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import create_async_engine

from app.business.db import BusinessStore, business_engine
from app.chat_api import ChatApiClient
from app.config import load_worker_settings
from app.worker.job import ATTEMPT_TIMEOUT_S, MAX_TRIES, WorkerDeps, generate_report
from app.worker.storage import ReportStorage


async def startup(ctx: dict[str, Any]) -> None:
    """Confere a configuração e monta as dependências do job; cria o bucket só no desenvolvimento."""
    settings = load_worker_settings()
    storage = ReportStorage.from_settings(settings)
    if settings.s3_create_bucket:
        await storage.ensure_bucket()
    ctx["deps"] = WorkerDeps(
        business=BusinessStore(
            business=business_engine(
                settings.business_database_url, settings.business_query_timeout_ms
            ),
            agents=create_async_engine(settings.database_url, pool_pre_ping=True),
            time_zone=ZoneInfo(settings.business_time_zone),
        ),
        chat=ChatApiClient(settings.chat_api_url, settings.chat_worker_token),
        storage=storage,
        redis=Redis.from_url(settings.redis_url, decode_responses=True),
    )


async def shutdown(ctx: dict[str, Any]) -> None:
    deps: WorkerDeps | None = ctx.get("deps")
    if deps is None:
        return
    await deps.chat.close()
    await deps.business.dispose()
    await deps.business.agents.dispose()
    await deps.redis.aclose()


class WorkerSettings:
    """As configurações do arq. O endereço do Redis é lido aqui porque o arq o pede na importação;
    a subida confere a configuração inteira."""

    functions: ClassVar[list[Any]] = [generate_report]
    on_startup = startup
    on_shutdown = shutdown
    # As novas tentativas são do job (`job.py`); o tempo limite do arq é só uma rede de segurança
    # acima do da tentativa.
    # Uma a mais que as do job: o job interrompido (o Worker reiniciado no meio da última) ainda
    # roda a falha final, em vez de o arq o descartar sem o "não consegui".
    max_tries = MAX_TRIES + 1
    job_timeout = int(ATTEMPT_TIMEOUT_S) + 30
    redis_settings = RedisSettings.from_dsn(os.environ["REDIS_URL"])
