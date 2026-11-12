"""Os tokens do Pedido no registro `pedido_concluido` (F11-T08): a saída soma o raciocínio, que o
provedor cobra como saída, uma vez só."""

from __future__ import annotations

from google.genai import types

from app.agent_requests.execution import Usage


def test_soma_a_entrada_e_a_saida_com_o_raciocinio_do_gemini() -> None:
    # O Gemini nativo informa o raciocínio fora dos candidatos.
    usage = Usage()
    usage.add(
        types.GenerateContentResponseUsageMetadata(
            prompt_token_count=1000,
            candidates_token_count=120,
            thoughts_token_count=600,
            total_token_count=1720,
        )
    )
    usage.add(
        types.GenerateContentResponseUsageMetadata(
            prompt_token_count=500, candidates_token_count=30, total_token_count=530
        )
    )
    usage.add(None)

    assert (usage.input_tokens, usage.output_tokens) == (1500, 750)


def test_nao_conta_duas_vezes_o_raciocinio_do_litellm() -> None:
    # O LiteLlm põe o raciocínio dentro dos candidatos e o repete em thoughts_token_count.
    usage = Usage()
    usage.add(
        types.GenerateContentResponseUsageMetadata(
            prompt_token_count=1000,
            candidates_token_count=720,
            thoughts_token_count=600,
            total_token_count=1720,
        )
    )

    assert (usage.input_tokens, usage.output_tokens) == (1000, 720)
