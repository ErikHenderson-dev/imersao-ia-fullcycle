"""A execução de um Pedido em segundo plano (spec da F11, "Execução do Pedido").

Uma sessão do ADK por Pedido, com o id dele e o contexto no estado; o texto final do modelo é
gravado pelo código como `reply`, pelo cliente da API do chat. Enquanto a API do chat aceita ações
do Pedido, ele nunca termina sem nada na Conversa: na falha, grava o "não consegui" (LLD, "Pedido
ao agente e Pergunta pendente").
"""

from __future__ import annotations

import functools
import importlib
import logging
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

from google.adk.agents.invocation_context import LlmCallsLimitExceededError
from google.adk.agents.run_config import RunConfig
from google.adk.apps import App
from google.adk.errors.already_exists_error import AlreadyExistsError
from google.adk.runners import Runner
from google.adk.sessions import BaseSessionService, Session
from google.genai import types

from app.agent_requests import context
from app.agent_requests.models import AgentRequestBody
from app.agent_requests.recorte import to_api_instant, uuid7_instant
from app.chat_api import CURRENT_CHAT_API, ChatApiClient, ChatApiError

logger = logging.getLogger(__name__)

# A resposta fixa quando o Agente não consegue atender (spec da F11, "Fim do Pedido"). Nunca há
# resposta simulada (HLD 6.3).
NAO_CONSEGUI = "Não consegui fazer o resumo agora. Tente de novo em instantes."
# Chamadas ao modelo por Pedido, parte do teto de custo (spec da F11, "Modelo de IA"); o teto de
# tokens de saída fica em app/model.py.
MAX_LLM_CALLS = 4
# A API do chat recusa o Pedido em si (inexistente, encerrado ou vencido): não há o que gravar.
REQUEST_GONE = frozenset({404, 409, 410})

# reply: gravou o texto do modelo; failed: gravou o "não consegui"; discarded: nada foi gravado.
Outcome = Literal["reply", "failed", "discarded"]


@dataclass(frozen=True)
class ExecutionDeps:
    session_service: BaseSessionService
    chat_api: ChatApiClient
    run_config: RunConfig = field(
        default_factory=lambda: RunConfig(max_llm_calls=MAX_LLM_CALLS)
    )


@dataclass
class Usage:
    """Os tokens do Pedido, somados do `usage_metadata` de cada evento."""

    input_tokens: int = 0
    output_tokens: int = 0

    def add(self, metadata: types.GenerateContentResponseUsageMetadata | None) -> None:
        if metadata:
            self.input_tokens += metadata.prompt_token_count or 0
            self.output_tokens += metadata.candidates_token_count or 0


@functools.cache
def agent_app(slug: str) -> App:
    """O App do ADK do agente, pela pasta dele em app/agents (o catálogo garante a pasta)."""
    return importlib.import_module(f"app.agents.{slug}.agent").app


def request_state(request: AgentRequestBody) -> dict[str, object]:
    """O contexto do Pedido que as ferramentas e as instruções leem do estado da sessão."""
    return {
        context.REQUEST_ID: str(request.request_id),
        context.CONVERSATION_ID: str(request.conversation_id),
        context.REQUESTER_ID: str(request.requester.id),
        context.REQUESTER_NAME: request.requester.name,
        context.REQUESTER_USERNAME: request.requester.username,
        context.TIME_ZONE: request.time_zone,
        context.REQUESTED_AT: to_api_instant(requested_at(request)),
        context.MENTIONS: [mention.model_dump() for mention in request.mentions],
    }


def requested_at(request: AgentRequestBody) -> datetime:
    """O instante da Mensagem do Pedido, pelo UUID v7 dela (ADR 0022); sem v7, a hora atual."""
    message_id = request.message.id
    return uuid7_instant(message_id) if message_id.version == 7 else datetime.now(UTC)


async def final_text(
    request: AgentRequestBody, deps: ExecutionDeps, session: Session, usage: Usage
) -> str | None:
    """Roda o agente na sessão do Pedido e devolve o texto final do modelo."""
    runner = Runner(app=agent_app(request.agent), session_service=deps.session_service)
    text: str | None = None
    async for event in runner.run_async(
        user_id=session.user_id,
        session_id=session.id,
        new_message=types.Content(
            role="user", parts=[types.Part.from_text(text=request.message.body)]
        ),
        state_delta=request_state(request),
        run_config=deps.run_config,
    ):
        usage.add(event.usage_metadata)
        if event.is_final_response() and event.content and event.content.parts:
            joined = "".join(part.text or "" for part in event.content.parts).strip()
            text = joined or text
    return text


async def run_request(request: AgentRequestBody, deps: ExecutionDeps) -> None:
    """Executa o Pedido, grava o desfecho na Conversa e registra o fim no log.

    É aqui que o texto final vira `reply` (F11-T03); a F11-T07 acrescenta o desvio da `question` e a
    retomada da sessão da continuação.
    """
    started = time.monotonic()
    usage = Usage()
    request_id = str(request.request_id)
    outcome = await execute(request, deps, usage)
    tempo_ms = round((time.monotonic() - started) * 1000)
    # Um registro por Pedido, sem texto de Mensagem (LLD, "Logs"): os campos no texto e em `extra`.
    fields = {
        "request_id": request_id,
        "desfecho": outcome,
        "tempo_ms": tempo_ms,
        "tokens_entrada": usage.input_tokens,
        "tokens_saida": usage.output_tokens,
    }
    logger.info(
        "pedido_concluido %s",
        " ".join(f"{key}={value}" for key, value in fields.items()),
        extra=fields,
    )


async def execute(
    request: AgentRequestBody, deps: ExecutionDeps, usage: Usage
) -> Outcome:
    CURRENT_CHAT_API.set(deps.chat_api)
    request_id = str(request.request_id)
    log = {"request_id": request_id}
    text: str | None = None
    try:
        session = await deps.session_service.create_session(
            app_name=agent_app(request.agent).name,
            user_id=str(request.requester.id),
            session_id=request_id,
        )
        text = await final_text(request, deps, session, usage)
    except AlreadyExistsError:
        # Duas entregas simultâneas do mesmo Pedido, que passaram juntas pela conferência da rota:
        # a primeira é que responde.
        logger.warning("Pedido %s entregue de novo; ignorado", request_id, extra=log)
        return "discarded"
    except LlmCallsLimitExceededError:
        logger.warning(
            "Pedido %s atingiu o teto de chamadas ao modelo", request_id, extra=log
        )
    except Exception as error:
        # Só o tipo: a mensagem de uma exceção pode citar texto do modelo ou da Conversa.
        logger.error(
            "Falha no Pedido %s: %s", request_id, type(error).__name__, extra=log
        )
    # O texto do modelo recusado por outro motivo que não o Pedido vira o "não consegui".
    if text:
        written = await write_reply(deps.chat_api, request_id, text)
        if written == "ok":
            return "reply"
        if written == "gone":
            return "discarded"
    written = await write_reply(deps.chat_api, request_id, NAO_CONSEGUI)
    if written == "ok":
        return "failed"
    if written == "refused":
        logger.error("Pedido %s terminou sem nada na Conversa", request_id, extra=log)
    return "discarded"


async def write_reply(
    chat_api: ChatApiClient, request_id: str, body: str
) -> Literal["ok", "gone", "refused"]:
    """Grava a `reply`: `gone` quando o Pedido não aceita mais ações, `refused` em qualquer outra
    recusa (o texto acima do tamanho máximo, a API fora)."""
    try:
        await chat_api.reply(request_id, body)
    except ChatApiError as error:
        logger.warning(
            "Resposta do Pedido %s recusada: %s",
            request_id,
            error.status or "sem resposta",
            extra={"request_id": request_id},
        )
        return "gone" if error.status in REQUEST_GONE else "refused"
    return "ok"
