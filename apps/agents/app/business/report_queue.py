"""A fila e a trava do Relatório (spec da F14, "Fila e job" e "Trava de um Relatório por vez").

A ferramenta `gerar_relatorio` prende a trava da Pessoa e enfileira o job com o id do Pedido como
`job_id`; o Worker solta a trava no fim, só se ela ainda for do Pedido dele. A carga leva só dados já
validados, nunca texto do Pedido para consulta: o texto vai só para a auditoria.
"""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from arq import ArqRedis
from redis.asyncio import Redis

from app.business.catalog import Filter, Period

# O nome da função do job no Worker.
JOB_NAME = "generate_report"

# Validade da trava do Relatório (LLD, "Valores e configuração"): solta a Pessoa se o Worker morrer
# sem apagar a trava.
LOCK_TTL_S = 10 * 60

# Apaga a trava só se o valor ainda é o id do Pedido: o Worker nunca solta a de outro Relatório.
RELEASE_SCRIPT = """
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
"""


@dataclass(frozen=True)
class ReportFilter:
    """O filtro já resolvido: o tipo do catálogo (`cliente`, `vendedor`, `produto`), o id do
    cadastro e o nome completo, para o título e o nome do arquivo."""

    type: str
    id: int
    name: str

    def catalog(self) -> Filter:
        return Filter(self.type, self.id)


@dataclass(frozen=True)
class ReportJob:
    request_id: str
    requester_id: str
    conversation_id: str
    # O texto do Pedido, só para a auditoria.
    question: str
    period: Period
    previous_period: Period
    filter: ReportFilter | None
    requested_at: datetime

    def to_payload(self) -> dict[str, Any]:
        return {
            "request_id": self.request_id,
            "requester_id": self.requester_id,
            "conversation_id": self.conversation_id,
            "question": self.question,
            "period": _period_payload(self.period),
            "previous_period": _period_payload(self.previous_period),
            "filter": None
            if self.filter is None
            else {
                "type": self.filter.type,
                "id": self.filter.id,
                "name": self.filter.name,
            },
            "requested_at": self.requested_at.isoformat(),
        }

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> ReportJob:
        filter = payload["filter"]
        return cls(
            request_id=payload["request_id"],
            requester_id=payload["requester_id"],
            conversation_id=payload["conversation_id"],
            question=payload["question"],
            period=_period_from(payload["period"]),
            previous_period=_period_from(payload["previous_period"]),
            filter=None
            if filter is None
            else ReportFilter(filter["type"], int(filter["id"]), filter["name"]),
            requested_at=datetime.fromisoformat(payload["requested_at"]),
        )


def _period_payload(period: Period) -> dict[str, str]:
    return {"start": period.start.isoformat(), "end": period.end.isoformat()}


def _period_from(payload: dict[str, str]) -> Period:
    return Period(
        date.fromisoformat(payload["start"]), date.fromisoformat(payload["end"])
    )


def lock_key(requester_id: str) -> str:
    """A trava de um Relatório por vez, por Pessoa."""
    return f"reports:active:{requester_id}"


async def acquire_lock(redis: Redis, requester_id: str, request_id: str) -> bool:
    """Prende a trava da Pessoa para o Pedido; falsa quando outro Relatório dela está em andamento."""
    return bool(
        await redis.set(lock_key(requester_id), request_id, nx=True, ex=LOCK_TTL_S)
    )


async def lock_owner(redis: Redis, requester_id: str) -> str | None:
    """O id do Pedido que prende a trava da Pessoa, ou nenhum."""
    owner = await redis.get(lock_key(requester_id))
    return owner.decode() if isinstance(owner, bytes) else owner


async def release_lock(redis: Redis, requester_id: str, request_id: str) -> bool:
    """Solta a trava só se ela ainda é do Pedido; verdadeira quando soltou."""
    released = await redis.eval(RELEASE_SCRIPT, 1, lock_key(requester_id), request_id)  # type: ignore[misc]
    return bool(released)


async def enqueue_report(queue: ArqRedis, job: ReportJob) -> bool:
    """Põe o job na fila com o id do Pedido como `job_id`; falsa quando ele já estava lá."""
    enqueued = await queue.enqueue_job(
        JOB_NAME, job.to_payload(), _job_id=job.request_id
    )
    return enqueued is not None


# A fila e a trava do Pedido em execução, como o cliente da API do chat: o `execute` a define antes
# de rodar o agente, e a ferramenta `gerar_relatorio` a lê.
CURRENT_REPORTS: ContextVar[ArqRedis | None] = ContextVar(
    "CURRENT_REPORTS", default=None
)
