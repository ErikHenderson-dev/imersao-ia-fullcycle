"""POST /v1/requests: o BFF entrega um Pedido, com a credencial de serviço (spec da F11, "Rota de
Pedido")."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, Request, Response

from app.agent_requests.execution import ExecutionDeps, run_request
from app.agent_requests.models import AgentRequestBody
from app.agent_requests.rate_limit import RequestRateLimiter
from app.agent_requests.typing_notice import while_typing
from app.problems import ProblemError
from app.registry.auth import require_service_token
from app.registry.catalog import AgentCard
from app.registry.store import connected_slugs

logger = logging.getLogger(__name__)


def build_router(
    catalog: list[AgentCard], deps: ExecutionDeps, limiter: RequestRateLimiter
) -> APIRouter:
    router = APIRouter(prefix="/v1", dependencies=[Depends(require_service_token)])
    slugs = {card.slug for card in catalog}
    # As execuções em andamento: a referência fica até o fim, para o coletor de lixo não cancelar a
    # tarefa.
    tasks: set[asyncio.Task[None]] = set()

    @router.post("/requests", status_code=202)
    async def receive_request(body: AgentRequestBody, request: Request) -> Response:
        # Nesta ordem: o Pedido a um Agente desconectado não gasta o limite da Pessoa.
        if body.agent not in slugs:
            raise ProblemError(404, "agent_not_found", "Agente não encontrado.")
        if body.agent not in await connected_slugs(request.app.state.engine):
            raise ProblemError(
                409, "agent_not_connected", "O agente não está conectado."
            )
        if not await limiter.allow(str(body.requester.id)):
            logger.warning(
                "Pedido %s recusado pelo limite de pedidos",
                body.request_id,
                extra={"request_id": str(body.request_id)},
            )
            raise ProblemError(
                429,
                "rate_limited",
                "Muitos pedidos em pouco tempo. Tente de novo em um minuto.",
            )
        # O Pedido roda com o "digitando" do bot em volta (F11-T05).
        task = asyncio.create_task(
            while_typing(deps.chat_api, str(body.request_id), run_request(body, deps))
        )
        tasks.add(task)
        task.add_done_callback(tasks.discard)
        return Response(status_code=202)

    return router
