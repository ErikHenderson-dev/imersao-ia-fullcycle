# Avaliação do `assistente` na F11-T04

Execução do `adk eval` com o evalset e o `test_config.json` de `apps/agents/tests/eval/assistente/`,
com o modelo padrão (`gemini-3.8-flash`) e o juiz `gemini-3.8-flash`, em 2026-11-11:

```bash
docker compose -f compose.yaml exec agents uv run --extra eval adk eval app/agents/assistente \
  tests/eval/assistente/assistente.evalset.json \
  --config_file_path tests/eval/assistente/test_config.json --print_detailed_results
```

**Resultado: 12 de 12 casos aprovados**, com `tool_trajectory_avg_score` (IN_ORDER) 1.0,
`rubric_based_final_response_quality_v1` 1.0 e `hallucinations_v1` 1.0 em todos.

| Caso | Fixture | Ferramenta esperada | Tokens (entrada / saída) | Duração |
| --- | --- | --- | --- | --- |
| `hoje` | `canal-geral` | `ler_mensagens(recorte="hoje")` | 2384 / 1036 | 10,1 s |
| `desde_ontem` | `canal-geral` | `ler_mensagens(recorte="desde_ontem")` | 2508 / 871 | 9,8 s |
| `semana` | `canal-geral` | `ler_mensagens(recorte="semana")` | 2568 / 947 | 10,9 s |
| `tudo` | `canal-geral` | `ler_mensagens(recorte="tudo")` | 2593 / 1215 | 12,0 s |
| `pessoa_por_mencao` | `canal-geral` | `ler_mensagens(recorte="hoje", pessoa="bruno")` | 2390 / 680 | 7,4 s |
| `pessoa_pelo_nome` | `canal-geral` | `ler_mensagens(recorte="tudo")` | 2687 / 780 | 8,2 s |
| `assunto` | `canal-geral` | `ler_mensagens(recorte="desde_ontem")` | 2573 / 858 | 9,2 s |
| `recorte_vazio` | `canal-parado` | `ler_mensagens(recorte="hoje")` | 2228 / 242 | 5,9 s |
| `teto` | `teto` (620 Mensagens) | `ler_mensagens(recorte="tudo")` | 24034 / 1321 | 12,5 s |
| `fora_tarefa` | — | nenhuma | 1054 / 190 | 2,9 s |
| `fora_dados` | — | nenhuma | 1035 / 208 | 4,1 s |
| `fora_outra_conversa` | — | nenhuma | 1036 / 334 | 4,0 s |

A saída inclui os tokens de raciocínio do modelo: no `assunto` da primeira rodada, 758 dos 870
tokens de saída eram de raciocínio.

## Rodadas

1. 11 de 12: no `assunto`, o modelo chamou `ler_mensagens(recorte="desde_ontem", pessoa=None)`, e o
   `None` explícito reprova a trajetória. As instruções e a descrição do argumento passaram a dizer
   para omitir `pessoa` sem Menção, e a ferramenta ganhou o `rotulo` do Recorte para o cabeçalho
   ("Resumo desde ontem", em vez de "Resumo de desde ontem").
2. 12 de 12, a tabela acima.

## Observações para a F11-T08

- As durações (de 6 a 12 s com leitura) passam do p95 ≤ 5 s do brief; a maior parte é raciocínio
  do modelo. A medição e o ajuste (teto de saída, orçamento de raciocínio) são da F11-T08 e da T06.
- Os casos de robustez (instruções injetadas, a mesma Pessoa por nome e por Menção), a pergunta sem
  Recorte e a continuação entram com a T07 e a T08, sobre as mesmas fixtures.
