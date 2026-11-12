"""O corpo de POST /v1/requests, que o BFF envia (spec da F11, "Rota de Pedido")."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel


class RequestMessage(BaseModel):
    id: uuid.UUID
    body: str


class Requester(BaseModel):
    id: uuid.UUID
    name: str
    username: str


class Mention(BaseModel):
    username: str
    name: str


class QuoteAuthor(BaseModel):
    name: str
    username: str


class RequestQuote(BaseModel):
    """A Mensagem citada pelo Pedido (spec da F12, "Rota de Pedido e execução")."""

    id: uuid.UUID
    body: str
    author: QuoteAuthor


class AgentRequestBody(BaseModel):
    request_id: uuid.UUID
    kind: Literal["new", "continuation"]
    parent_request_id: uuid.UUID | None
    # O slug do Agente no catálogo.
    agent: str
    conversation_id: uuid.UUID
    message: RequestMessage
    requester: Requester
    # As Menções a Pessoas que a API do chat resolveu na gravação.
    mentions: list[Mention]
    # O fuso IANA de quem pediu.
    time_zone: str
    # A Mensagem citada, ou nula; opcional, para o BFF anterior continuar aceito.
    quote: RequestQuote | None = None
