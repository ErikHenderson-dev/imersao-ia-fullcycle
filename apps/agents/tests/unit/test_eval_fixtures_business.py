"""A avaliação da consulta (spec da F13, "Decisões de teste"; F13-T07, CA2)."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.business.db import CURRENT_BUSINESS
from app.chat_api import CURRENT_CHAT_API
from app.eval_fixtures import (
    EvalBusinessStore,
    EvalChatApi,
    eval_business_store,
    fixture_tool_callback,
)

EVAL_DIR = Path(__file__).resolve().parents[1] / "eval" / "assistente"


def cases(name: str) -> list[dict]:
    return json.loads((EVAL_DIR / name).read_text(encoding="utf-8"))["eval_cases"]


def tools_of(case: dict) -> list[str]:
    return [
        use["name"]
        for turn in case["conversation"]
        for use in turn["intermediate_data"]["tool_uses"]
    ]


def test_o_evalset_de_dados_tem_os_30_casos_das_categorias_da_spec() -> None:
    dados = cases("dados.evalset.json")

    assert len(dados) == 30
    assert all(
        c["session_input"]["state"]["business_today"] == "2026-10-15" for c in dados
    )
    kinds = Counter()
    for case in dados:
        args = [
            use["args"]
            for turn in case["conversation"]
            for use in turn["intermediate_data"]["tool_uses"]
        ]
        state = case["session_input"]["state"]
        if not args:
            kinds["sem ferramenta"] += 1
        elif "perguntar_periodo" in tools_of(case):
            kinds["sem período"] += 1
        elif not state["data_access"]:
            kinds["sem permissão"] += 1
        elif "comparar_inicio" in args[0]:
            kinds["comparação"] += 1
        elif "filtro_nome" in args[0]:
            kinds["filtro"] += 1
        else:
            kinds["métrica"] += 1
    assert kinds["métrica"] >= 10
    assert kinds["filtro"] >= 5
    assert kinds["comparação"] >= 2
    assert kinds["sem período"] >= 2
    assert kinds["sem permissão"] >= 2
    assert kinds["sem ferramenta"] >= 7
    assert (EVAL_DIR / "test_config_dados.json").exists()


def test_o_caso_fora_dados_espera_a_consulta() -> None:
    [fora] = [
        c for c in cases("assistente.evalset.json") if c["eval_id"] == "fora_dados"
    ]

    assert tools_of(fora) == ["consultar_dados"]


@pytest.mark.asyncio
async def test_o_callback_deixa_a_consulta_rodar_com_a_api_do_chat_da_avaliacao(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "BUSINESS_DATABASE_URL", "postgresql+asyncpg://x:y@127.0.0.1:9/nada"
    )
    ctx = SimpleNamespace(
        state={"eval_fixture": "canal-geral"}, agent_name="assistente"
    )

    result = await fixture_tool_callback(
        SimpleNamespace(name="consultar_dados"),  # type: ignore[arg-type]
        {},
        ctx,  # type: ignore[arg-type]
    )

    assert result is None
    assert isinstance(CURRENT_CHAT_API.get(), EvalChatApi)
    assert isinstance(CURRENT_BUSINESS.get(), EvalBusinessStore)
    eval_business_store.cache_clear()
