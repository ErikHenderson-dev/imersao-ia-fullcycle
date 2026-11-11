"""Rotas /v1 do registro de Agentes, todas com a credencial de serviço."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.registry.auth import require_service_token
from app.registry.catalog import AgentCard
from app.registry.store import connected_slugs


class AgentResponse(BaseModel):
    slug: str
    name: str
    username: str
    description: str
    connected: bool


class AgentsResponse(BaseModel):
    agents: list[AgentResponse]


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

    return router
