# Avaliação do assistente com a delegação

2026-11-12 · F12-T06 · Critério: brief, "Qualidade do agente" (≥ 98% da avaliação completa) e
"Custo por pedido" (≤ US$ 0,01)

**Resultado: 43 de 43 casos aprovados (100%), com o `gemini-3.6-flash` no raciocínio mínimo.**

| Evalset | Configuração | Casos | Aprovados |
| --- | --- | --- | --- |
| `assistente.evalset.json` (resumo da F11 e perguntas da delegação) | `test_config.json` | 30 | 30 |
| `delegacao.evalset.json` (casos que chamam `delegar_tarefa`) | `test_config_delegacao.json` | 13 | 13 |

## Como a delegação é conferida (CA1)

A primeira rodada, com todos os casos num evalset só, aprovou 30 de 43: os 13 casos que chamam
`delegar_tarefa` reprovaram só no critério de trajetória, com o Responsável certo e as rubricas
aprovadas. O `tool_trajectory_avg_score` compara todos os argumentos, e o `titulo` é texto livre.

O MCP `adk-docs` não conectou nesta sessão. A opção do critério foi conferida no código do ADK
instalado (`google/adk/evaluation/trajectory_evaluator.py`): o critério aceita `ignore_args`, que
vale para a configuração inteira. Como os casos de resumo dependem da comparação exata do Recorte,
os casos de delegação foram para um evalset próprio, com `ignore_args` na configuração dele. O
Responsável continua conferido exatamente: a API do chat da avaliação (`EvalChatApi`) recusa a ação
`task` com outro Responsável que não o `eval_expected_assignee` do caso, e a rubrica
`responsavel_certo` de cada caso confere a chamada; o título é conferido pela rubrica `titulo_fiel`.
Falta confirmar com o MCP `adk-docs` que `ignore_args` é a forma recomendada.

A segunda rodada aprovou 10 de 13 na delegação: a rubrica `responsavel_certo` valia também para a
primeira vez dos casos de duas rodadas, que só pergunta. Com o texto da rubrica valendo só na vez em
que o Agente delega, os três casos passaram.

## Custo

Pelo `token_usage_v1`, com o preço da F11 (US$ 0,75 por milhão de tokens de entrada e US$ 3,75 por
milhão de saída, `../../../11-resumo-de-conversa-pelo-agente/tarefas/08-avaliacao-medicao-e-acessibilidade/medicao-p95.md`):

| Evalset | Vezes do modelo | Tokens por vez, em média (entrada / saída) | Custo médio por vez |
| --- | --- | --- | --- |
| Delegação | 16 | 2.942 / 32 | US$ 0,0023 |
| Resumo e perguntas | 34 | 5.208 / 103 | US$ 0,0043 |

A maior vez da delegação usou 5.609 tokens (cerca de US$ 0,0043). O Pedido de delegação fica abaixo
da meta de US$ 0,01; o resumo numa Conversa de 500 Mensagens, medido na F11, segue acima dela.

## Comando

```bash
uv run --extra eval adk eval app/agents/assistente tests/eval/assistente/assistente.evalset.json --config_file_path tests/eval/assistente/test_config.json
uv run --extra eval adk eval app/agents/assistente tests/eval/assistente/delegacao.evalset.json --config_file_path tests/eval/assistente/test_config_delegacao.json
```
