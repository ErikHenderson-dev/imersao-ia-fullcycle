"""Credencial de serviço do BFF para o Serviço de agentes (spec da F10, "Rotas e credencial")."""

from __future__ import annotations

import hmac

from fastapi import Request

from app.problems import ProblemError

UNAUTHORIZED = ProblemError(
    401, "unauthorized", "Credencial de serviço ausente ou inválida."
)


def require_service_token(request: Request) -> None:
    """Exige `Authorization: Bearer <AGENTS_SERVICE_TOKEN>`, conferido em tempo constante."""
    expected: str = request.app.state.service_token
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(
        token.strip().encode(), expected.encode()
    ):
        raise ProblemError(UNAUTHORIZED.status, UNAUTHORIZED.code, UNAUTHORIZED.detail)
