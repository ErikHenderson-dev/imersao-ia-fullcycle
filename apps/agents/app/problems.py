"""Erros do Serviço de agentes no corpo do LLD ("Erros"): application/problem+json com `code`."""

from __future__ import annotations

from http import HTTPStatus

from fastapi import FastAPI, Request
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

    app.add_exception_handler(ProblemError, handle)
