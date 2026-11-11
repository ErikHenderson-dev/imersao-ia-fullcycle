"""A execução de um Pedido em segundo plano (spec da F11, "Execução do Pedido").

Uma sessão do ADK por Pedido, com o id dele e o contexto no estado; o texto final do modelo é
gravado pelo código como `reply`, pelo cliente da API do chat.
"""

from __future__ import annotations

import functools
import importlib
import logging
from dataclasses import dataclass

from google.adk.apps import App
from google.adk.runners import Runner
from google.adk.sessions import BaseSessionService
from google.genai import types

from app.agent_requests import context
from app.agent_requests.models import AgentRequestBody
from app.chat_api import ChatApiClient

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExecutionDeps:
    session_service: BaseSessionService
    chat_api: ChatApiClient


@functools.cache
def agent_app(slug: str) -> App:
    """O App do ADK do agente, pela pasta dele em app/agents (o catálogo garante a pasta)."""
    return importlib.import_module(f"app.agents.{slug}.agent").app


def request_state(request: AgentRequestBody) -> dict[str, str]:
    """O contexto do Pedido que as ferramentas leem do estado da sessão."""
    return {
        context.REQUEST_ID: str(request.request_id),
        context.CONVERSATION_ID: str(request.conversation_id),
        context.REQUESTER_ID: str(request.requester.id),
        context.REQUESTER_NAME: request.requester.name,
        context.REQUESTER_USERNAME: request.requester.username,
        context.TIME_ZONE: request.time_zone,
    }


async def final_text(request: AgentRequestBody, deps: ExecutionDeps) -> str | None:
    """Roda o agente numa sessão nova, com o id do Pedido, e devolve o texto final do modelo."""
    app = agent_app(request.agent)
    user_id = str(request.requester.id)
    session = await deps.session_service.create_session(
        app_name=app.name, user_id=user_id, session_id=str(request.request_id)
    )
    runner = Runner(app=app, session_service=deps.session_service)
    text: str | None = None
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session.id,
        new_message=types.Content(
            role="user", parts=[types.Part.from_text(text=request.message.body)]
        ),
        state_delta=request_state(request),
    ):
        if event.is_final_response() and event.content and event.content.parts:
            joined = "".join(part.text or "" for part in event.content.parts).strip()
            text = joined or text
    return text


async def run_request(request: AgentRequestBody, deps: ExecutionDeps) -> None:
    """Executa o Pedido e grava o texto final como `reply`.

    É aqui que o texto final vira `reply` (F11-T03): o "não consegui", o teto e o log por Pedido
    entram neste ponto na F11-T06, e o desvio da `question` e a retomada da sessão da continuação na
    F11-T07. Por ora, uma falha só vai para o log, sem texto de Mensagem.
    """
    try:
        text = await final_text(request, deps)
        if text:
            await deps.chat_api.reply(str(request.request_id), text)
        else:
            logger.error("Pedido %s terminou sem texto final", request.request_id)
    except Exception:
        logger.exception("Falha no Pedido %s", request.request_id)
