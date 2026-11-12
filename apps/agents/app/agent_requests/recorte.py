"""O Recorte de tempo em instantes UTC, pelo fuso de quem pediu (spec da F11, "O Agente
`assistente`", `ler_mensagens`).

O modelo só escolhe o Recorte; a data é calculada aqui, contra o instante do Pedido (o da Mensagem
do Pedido), e a API do chat recebe e devolve UTC. A `perguntar_recorte` (F11-T07) usa a mesma
conversão para as contagens.
"""

from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal, get_args
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

Recorte = Literal["hoje", "desde_ontem", "semana", "tudo"]
RECORTES: tuple[str, ...] = get_args(Recorte)

# O fuso padrão do LLD ("Valores e configuração"), para um fuso que não existe.
DEFAULT_TIME_ZONE = "America/Sao_Paulo"


@dataclass(frozen=True)
class Interval:
    # Inclusivo; nenhum em `tudo`.
    since: datetime | None
    # Exclusivo: o instante do Pedido, para o próprio pedido ficar fora.
    until: datetime


def zone(time_zone: str) -> ZoneInfo:
    """O fuso IANA, ou o padrão quando ele não existe."""
    try:
        return ZoneInfo(time_zone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TIME_ZONE)


def _local_midnight(instant: datetime, tz: ZoneInfo, days_back: int) -> datetime:
    day = instant.astimezone(tz).date() - timedelta(days=days_back)
    return datetime(day.year, day.month, day.day, tzinfo=tz).astimezone(UTC)


def recorte_interval(recorte: str, time_zone: str, requested_at: datetime) -> Interval:
    """Hoje desde 00:00 locais, desde ontem desde 00:00 locais da véspera, a semana desde
    7 dias de 24 h antes do Pedido e tudo sem início; todos até o instante do Pedido."""
    tz = zone(time_zone)
    until = requested_at.astimezone(UTC)
    match recorte:
        case "hoje":
            since = _local_midnight(until, tz, 0)
        case "desde_ontem":
            since = _local_midnight(until, tz, 1)
        case "semana":
            since = until - timedelta(days=7)
        case "tudo":
            since = None
        case _:
            raise ValueError(f"Recorte desconhecido: {recorte}")
    return Interval(since=since, until=until)


def uuid7() -> uuid.UUID:
    """Um UUID v7 (ADR 0022): 48 bits de milissegundos e o resto aleatório."""
    value = (time.time_ns() // 1_000_000) << 80 | int.from_bytes(os.urandom(10))
    value = (value & ~(0xF << 76)) | (0x7 << 76)
    value = (value & ~(0x3 << 62)) | (0x2 << 62)
    return uuid.UUID(int=value)


def uuid7_instant(value: uuid.UUID) -> datetime:
    """O instante dos 48 bits de tempo de um UUID v7 (ADR 0022)."""
    milliseconds = value.int >> 80
    return datetime(1970, 1, 1, tzinfo=UTC) + timedelta(milliseconds=milliseconds)


def to_api_instant(instant: datetime) -> str:
    """ISO 8601 em UTC, com milissegundos e `Z`, como a API do chat recebe."""
    return (
        instant.astimezone(UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
