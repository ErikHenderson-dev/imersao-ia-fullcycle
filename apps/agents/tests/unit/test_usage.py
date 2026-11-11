"""Os tokens do Pedido no registro `pedido_concluido` (F11-T08): a saída soma o raciocínio, que o
Gemini informa à parte e cobra como saída."""

from __future__ import annotations

from google.genai import types

from app.agent_requests.execution import Usage


def test_soma_a_entrada_e_a_saida_com_o_raciocinio() -> None:
    usage = Usage()
    usage.add(
        types.GenerateContentResponseUsageMetadata(
            prompt_token_count=1000,
            candidates_token_count=120,
            thoughts_token_count=600,
        )
    )
    usage.add(
        types.GenerateContentResponseUsageMetadata(
            prompt_token_count=500, candidates_token_count=30
        )
    )
    usage.add(None)

    assert (usage.input_tokens, usage.output_tokens) == (1500, 750)
