"""Rotas /v1 do registro de Agentes, todas com a credencial de serviço."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, StrictBool

from app.problems import ProblemError
from app.registry.auth import require_service_token
from app.registry.catalog import AgentCard
from app.registry.store import connect, connected_slugs


class AgentResponse(BaseModel):
    slug: str
    name: str
    username: str
    description: str
    connected: bool


class AgentsResponse(BaseModel):
    agents: list[AgentResponse]


class ConnectionRequest(BaseModel):
    """Quem pede e o papel dela, enviados pelo BFF (ADR 0015)."""

    person_id: uuid.UUID
    is_admin: StrictBool


def _require_admin_and_agent(
    body: ConnectionRequest, slug: str, catalog: list[AgentCard]
) -> None:
    # O papel antes do catálogo: quem não administra não descobre o catálogo pela resposta.
    if not body.is_admin:
        raise ProblemError(
            403, "forbidden", "Só administradores conectam ou desconectam agentes."
        )
    if all(card.slug != slug for card in catalog):
        raise ProblemError(404, "agent_not_found", "Agente não encontrado.")


def build_router(catalog: list[AgentCard]) -> APIRouter:
    # A credencial no router: nenhuma rota /v1 nasce sem ela.
    router = APIRouter(prefix="/v1", dependencies=[Depends(require_service_token)])

    @router.get("/agents", response_model=AgentsResponse)
    async def list_agents(request: Request) -> AgentsResponse:
        # Uma linha de slug fora do catálogo (Agente removido numa versão nova) é ignorada.
        connected = await connected_slugs(request.app.state.engine)
        return AgentsResponse(
            agents=[
                AgentResponse(
                    slug=card.slug,
                    name=card.name,
                    username=card.username,
                    description=card.description,
                    connected=card.slug in connected,
                )
                for card in catalog
            ]
        )

    @router.put("/agents/{slug}/connection", status_code=204)
    async def connect_agent(
        slug: str, body: ConnectionRequest, request: Request
    ) -> Response:
        _require_admin_and_agent(body, slug, catalog)
        await connect(request.app.state.engine, slug, body.person_id)
        return Response(status_code=204)

    return router
