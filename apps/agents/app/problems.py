"""Erros do Serviço de agentes no corpo do LLD ("Erros"): application/problem+json com `code`."""

from __future__ import annotations

from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

PROBLEM_JSON = "application/problem+json"


class ProblemError(Exception):
    """Um erro com código estável, que o handler do app traduz na resposta."""

    def __init__(self, status: int, code: str, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.code = code
        self.detail = detail


def problem_response(status: int, code: str, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        media_type=PROBLEM_JSON,
        content={
            "type": "about:blank",
            "title": HTTPStatus(status).phrase,
            "status": status,
            "detail": detail,
            "code": code,
        },
    )


def install_problem_handler(app: FastAPI) -> None:
    async def handle(_request: Request, error: Exception) -> JSONResponse:
        assert isinstance(error, ProblemError)
        return problem_response(error.status, error.code, error.detail)

    async def handle_validation(_request: Request, _error: Exception) -> JSONResponse:
        # A entrada fora do contrato, com o mesmo código da API do chat.
        return problem_response(
            400, "validation_failed", "Os dados enviados são inválidos."
        )

    app.add_exception_handler(ProblemError, handle)
    app.add_exception_handler(RequestValidationError, handle_validation)
