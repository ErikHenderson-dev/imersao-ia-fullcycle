# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from google.adk.cli.fast_api import get_fast_api_app
from sqlalchemy.ext.asyncio import create_async_engine

from app.agent_requests.routes import build_router as build_requests_router
from app.app_utils import services
from app.chat_api import ChatApiClient
from app.config import Settings, load_settings
from app.problems import install_problem_handler
from app.registry.catalog import load_catalog
from app.registry.routes import build_router

load_dotenv()

# Cada subpasta de app/agents é um agente, servido em /apps/<pasta>.
AGENTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agents")


def create_app(settings: Settings) -> FastAPI:
    """O app HTTP, de um de dois jeitos (spec da F10, "Rotas e credencial").

    Com ADK_DEV_ROUTES verdadeiro, só no desenvolvimento, é o app do get_fast_api_app, com as rotas
    genéricas e a interface web do ADK, e o router /v1 entra nele. Senão, é um FastAPI só com /v1 e
    GET /health: abertas na rede privada, as rotas genéricas rodariam um agente sem credencial.
    """
    # Uma pasta de agente sem card.py faz a subida falhar com o nome dela.
    catalog = load_catalog()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    # O Agente age na Conversa pela API do chat, como bot (spec da F11, "Execução do Pedido").
    chat_api = ChatApiClient(settings.chat_api_url, settings.chat_bot_token)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield
        await chat_api.close()
        await engine.dispose()

    if settings.adk_dev_routes:
        app = get_fast_api_app(
            agents_dir=AGENTS_DIR,
            web=True,
            artifact_service_uri=services.ARTIFACT_SERVICE_URI,
            allow_origins=settings.allow_origins_list,
            session_service_uri=services.SESSION_SERVICE_URI,
            lifespan=lifespan,
        )
    else:
        app = FastAPI(lifespan=lifespan)

        @app.get("/health")
        async def health() -> dict[str, str]:
            return {"status": "ok"}

    app.title = "agents"
    app.description = "API do Serviço de agentes"
    app.state.engine = engine
    app.state.service_token = settings.agents_service_token
    app.state.chat_api = chat_api
    # As sessões dos Pedidos, no Banco dos agentes com SESSION_SERVICE_URI.
    app.state.session_service = services.build_session_service(
        settings.session_service_uri
    )
    app.state.request_tasks = set()
    install_problem_handler(app)
    app.include_router(build_router(catalog))
    app.include_router(build_requests_router(catalog))
    return app


app: FastAPI = create_app(load_settings())


# Main execution
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
