"""O limite de pedidos por Pessoa (spec da F11, "Rota de Pedido"; LLD, "Contadores (Redis)").

Um contador por Pessoa e minuto no Redis, em janela fixa, somando todas as Conversas. Com o Redis
fora, o Pedido é recusado: sem o contador, o limite não vale.
"""

from __future__ import annotations

import time

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.problems import ProblemError

WINDOW_S = 60
DELIVERY_KEY = "agent_requests:delivery"
# A reserva só precisa durar até a sessão do Pedido existir, o que acontece no começo da execução;
# depois, a reentrega é barrada pela sessão.
DELIVERY_CLAIM_S = 600


class RequestRateLimiter:
    def __init__(self, redis: Redis, limit: int) -> None:
        self._redis = redis
        self._limit = limit

    async def allow(self, person_id: str) -> bool:
        """Conta o Pedido na janela atual da Pessoa e diz se ele cabe no limite."""
        key = f"agent_requests:{person_id}:{int(time.time()) // WINDOW_S}"
        try:
            async with self._redis.pipeline(transaction=True) as pipe:
                count, _ = await pipe.incr(key).expire(key, WINDOW_S, nx=True).execute()
        except RedisError as error:
            raise ProblemError(
                503,
                "agents_unavailable",
                "O serviço de agentes está indisponível.",
            ) from error
        return count <= self._limit

    async def claim_delivery(self, request_id: str) -> bool:
        """Reserva a entrega do Pedido antes de contá-lo: só a primeira de entregas simultâneas do
        mesmo Pedido ganha a reserva, e as outras não gastam o limite da Pessoa."""
        try:
            claimed = await self._redis.set(
                f"{DELIVERY_KEY}:{request_id}", 1, nx=True, ex=DELIVERY_CLAIM_S
            )
        except RedisError as error:
            raise ProblemError(
                503,
                "agents_unavailable",
                "O serviço de agentes está indisponível.",
            ) from error
        return bool(claimed)

    async def release_delivery(self, request_id: str) -> None:
        """Solta a reserva do Pedido recusado pelo limite, para o reenvio dele ser contado de novo."""
        try:
            await self._redis.delete(f"{DELIVERY_KEY}:{request_id}")
        except RedisError:
            # Sem soltar, a reserva vence sozinha em DELIVERY_CLAIM_S.
            pass
