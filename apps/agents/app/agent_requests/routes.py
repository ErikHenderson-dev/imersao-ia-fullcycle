"""POST /v1/requests: o BFF entrega um Pedido, com a credencial de serviço (spec da F11, "Rota de
Pedido")."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Response

from app.agent_requests.execution import ExecutionDeps, run_request
from app.agent_requests.models import AgentRequestBody
from app.problems import ProblemError
from app.registry.auth import require_service_token
from app.registry.catalog import AgentCard


def build_router(catalog: list[AgentCard], deps: ExecutionDeps) -> APIRouter:
    router = APIRouter(prefix="/v1", dependencies=[Depends(require_service_token)])
    slugs = {card.slug for card in catalog}
    # As execuções em andamento: a referência fica até o fim, para o coletor de lixo não cancelar a
    # tarefa.
    tasks: set[asyncio.Task[None]] = set()

    @router.post("/requests", status_code=202)
    async def receive_request(body: AgentRequestBody) -> Response:
        if body.agent not in slugs:
            raise ProblemError(404, "agent_not_found", "Agente não encontrado.")
        # A conexão e o limite de pedidos entram aqui, antes do aceite, na F11-T06.
        task = asyncio.create_task(run_request(body, deps))
        tasks.add(task)
        task.add_done_callback(tasks.discard)
        return Response(status_code=202)

    return router
