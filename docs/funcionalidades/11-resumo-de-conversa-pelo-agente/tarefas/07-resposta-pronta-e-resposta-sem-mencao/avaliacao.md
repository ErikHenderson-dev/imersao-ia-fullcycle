# Avaliação do `assistente` na F11-T07

Execução do `adk eval` só com os casos de vários turnos desta tarefa, com o evalset e o
`test_config.json` de `apps/agents/tests/eval/assistente/`, o modelo padrão (`gemini-3.8-flash`) e o
juiz `gemini-3.8-flash`, em 2026-11-11:

```bash
docker compose -f compose.yaml exec agents uv run --extra eval adk eval app/agents/assistente \
  "tests/eval/assistente/assistente.evalset.json:pergunta_e_botao,pergunta_e_resposta_escrita,resposta_que_nao_responde" \
  --config_file_path tests/eval/assistente/test_config.json --print_detailed_results
```

**Resultado: 3 de 3 casos aprovados**, com `tool_trajectory_avg_score` (IN_ORDER) 1.0,
`rubric_based_final_response_quality_v1` 1.0 e `hallucinations_v1` 1.0 em todos. Os casos usam a
fixture `canal-geral`, com o Pedido às 15:00 de 10/11 em São Paulo; a `perguntar_recorte` recebe as
contagens da fixture ("Hoje (4)", "Desde ontem (7)", "A semana (8)", "Tudo (9)").

| Caso | Turno | Mensagem | Ferramenta esperada e obtida | Tokens (entrada / saída) | Duração |
| --- | --- | --- | --- | --- | --- |
| `pergunta_e_botao` | 1 | "@assistente faz um resumo" | `perguntar_recorte()` | 1349 / 100 | 2,5 s |
| | 2 | "Desde ontem (7)" | `ler_mensagens(recorte="desde_ontem")` | 3641 / 1155 | 10,6 s |
| `pergunta_e_resposta_escrita` | 1 | "@assistente me dá um resumo da conversa?" | `perguntar_recorte()` | 1353 / 118 | 2,8 s |
| | 2 | "só de hoje" | `ler_mensagens(recorte="hoje")` | 3526 / 1224 | 11,6 s |
| `resposta_que_nao_responde` | 1 | "@assistente resume pra mim" | `perguntar_recorte()` | 1349 / 132 | 2,9 s |
| | 2 | "@ana você viu o deploy?" | nenhuma | 1554 / 304 | 3,4 s |

## O que a execução mostra

- O primeiro turno faz uma chamada ao modelo só: a `perguntar_recorte` liga o
  `skip_summarization`, e o evento da ferramenta é a resposta final, sem texto. Por isso a rubrica
  geral "portugues" passou a aceitar a resposta sem texto, e o `hallucinations_v1` não avalia esse
  turno (`NOT_EVALUATED` por turno, média só dos turnos com texto).
- No segundo turno, o modelo reconhece o Recorte pelo começo do rótulo do botão e pela resposta
  escrita, na mesma sessão, com a pergunta no histórico; as rubricas de cada caso ficam no segundo
  turno (`rubrics` da invocação).
- A Mensagem que não responde recebe a frase fixa `NAO_ENTENDI`, sem ler nem perguntar de novo.
- Os casos da F11-T04 não foram rodados de novo nesta tarefa (só os testes criados ou alterados, a
  pedido do usuário); a avaliação completa fica para a F11-T08.
