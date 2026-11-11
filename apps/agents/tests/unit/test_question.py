"""Os rótulos e os intervalos da pergunta pelo Recorte (F11-T07, CA5)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from app.agent_requests.question import (
    count_window,
    quick_reply_labels,
    recorte_options,
)


def utc(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


# 10/11/2026, 15:00 em São Paulo (UTC-3).
STATE = {"time_zone": "America/Sao_Paulo", "requested_at": "2026-11-10T18:00:00.000Z"}


class RecordingCounter:
    """Guarda o pedido de contagens e devolve números fixos, como a rota de contagens."""

    def __init__(self) -> None:
        self.calls: list[tuple[list[datetime], datetime]] = []

    async def count(self, sinces: list[datetime], until: datetime) -> dict[str, Any]:
        self.calls.append((sinces, until))
        return {
            "counts": [
                {"since": since.isoformat(), "count": count}
                for since, count in zip(sinces, [3, 5, 12], strict=True)
            ],
            "total": 24,
        }


def test_os_rotulos_das_respostas_prontas_saem_das_contagens() -> None:
    assert quick_reply_labels([3, 5, 12], 24) == [
        "Hoje (3)",
        "Desde ontem (5)",
        "A semana (12)",
        "Tudo (24)",
    ]


def test_os_intervalos_das_contagens_sao_os_da_leitura() -> None:
    window = count_window(STATE)

    assert window.sinces == [
        utc("2026-11-10T03:00:00"),
        utc("2026-11-09T03:00:00"),
        utc("2026-11-03T18:00:00"),
    ]
    assert window.until == utc("2026-11-10T18:00:00")


@pytest.mark.asyncio
async def test_as_opcoes_pedem_as_contagens_uma_vez() -> None:
    counter = RecordingCounter()

    options = await recorte_options(counter, STATE)

    assert options == ["Hoje (3)", "Desde ontem (5)", "A semana (12)", "Tudo (24)"]
    assert counter.calls == [(count_window(STATE).sinces, utc("2026-11-10T18:00:00"))]
