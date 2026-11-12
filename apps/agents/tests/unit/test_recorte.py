"""A conversão do Recorte em instantes UTC pelo fuso de quem pediu (F11-T04, CA3)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

from app.agent_requests.recorte import (
    Interval,
    recorte_interval,
    to_api_instant,
    uuid7_instant,
)

SAO_PAULO = "America/Sao_Paulo"


def utc(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


# 10/11/2026, 15:00 em São Paulo (UTC-3).
PEDIDO = utc("2026-11-10T18:00:00")


@pytest.mark.parametrize(
    ("recorte", "since"),
    [
        ("hoje", utc("2026-11-10T03:00:00")),
        ("desde_ontem", utc("2026-11-09T03:00:00")),
        ("semana", utc("2026-11-03T18:00:00")),
        ("tudo", None),
    ],
)
def test_converte_os_quatro_recortes(recorte: str, since: datetime | None) -> None:
    assert recorte_interval(recorte, SAO_PAULO, PEDIDO) == Interval(
        since=since, until=PEDIDO
    )


@pytest.mark.parametrize(
    ("pedido", "since"),
    [
        # 01:30 em São Paulo: o dia local já é 10/11, embora o UTC também seja.
        (utc("2026-11-10T04:30:00"), utc("2026-11-10T03:00:00")),
        # 23:30 em São Paulo: o UTC já virou para 11/11, mas o dia local ainda é 10/11.
        (utc("2026-11-11T02:30:00"), utc("2026-11-10T03:00:00")),
    ],
)
def test_hoje_na_virada_do_dia(pedido: datetime, since: datetime) -> None:
    assert recorte_interval("hoje", SAO_PAULO, pedido).since == since


def test_hoje_em_outro_fuso() -> None:
    # 18:00 UTC é 03:00 de 11/11 em Tóquio (UTC+9): o dia começa às 15:00 UTC de 10/11.
    interval = recorte_interval("hoje", "Asia/Tokyo", PEDIDO)

    assert interval.since == utc("2026-11-10T15:00:00")


def test_desde_ontem_em_outro_fuso() -> None:
    interval = recorte_interval("desde_ontem", "Asia/Tokyo", PEDIDO)

    assert interval.since == utc("2026-11-09T15:00:00")


def test_fuso_invalido_usa_o_padrao() -> None:
    interval = recorte_interval("hoje", "Fuso/Inexistente", PEDIDO)

    assert interval.since == utc("2026-11-10T03:00:00")


def test_instante_do_pedido_pelo_uuid_v7() -> None:
    milliseconds = int(utc("2026-11-10T18:00:00.123").timestamp() * 1000)
    value = uuid.UUID(int=(milliseconds << 80) | (0x7 << 76) | (0x2 << 62) | 0xABC)

    assert uuid7_instant(value) == utc("2026-11-10T18:00:00.123")


def test_instante_na_api_em_utc_com_z() -> None:
    assert to_api_instant(utc("2026-11-10T03:00:00")) == "2026-11-10T03:00:00.000Z"
