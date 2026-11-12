# Avaliação do assistente com a consulta

2026-11-12 · F13-T07 · Critério: brief, "Qualidade do agente" (≥ 98% da avaliação completa),
"Número errado entregue" (meta 0) e "Custo por pedido"

**Resultado: 72 de 73 casos aprovados (98,6%), acima da meta de 98%, com o `gemini-3.6-flash` no
raciocínio mínimo.** A primeira tentativa (no começo do dia) parou no `402 RESOURCE_EXHAUSTED` da chave;
com o crédito de volta, a avaliação completa rodou.

| Evalset | Configuração | Casos | Aprovados |
| --- | --- | --- | --- |
| `assistente.evalset.json` (resumo da F11, perguntas da delegação e o `fora_dados`, agora consulta) | `test_config.json` | 30 | 29 |
| `delegacao.evalset.json` (casos que chamam `delegar_tarefa`) | `test_config_delegacao.json` | 13 | 13 |
| `dados.evalset.json` (consulta a Dados de negócio) | `test_config_dados.json` | 30 | 30 |

O caso reprovado, `continuacao_que_nao_completa` (resumo da F11), passou na trajetória e na rubrica e
reprovou só no `hallucinations_v1`; rodado de novo duas vezes, reprovou uma e passou outra: é variação
do juiz num caso que a F13 não mudou.

## Custo

Pelo `token_usage_v1`, com o preço da F11 (US$ 0,75 por milhão de tokens de entrada e US$ 3,75 por
milhão de saída):

| Evalset | Casos | Tokens por caso, em média (entrada / saída) | Custo médio por caso | Maior caso |
| --- | --- | --- | --- | --- |
| Consulta (dados) | 30 | 4.347 / 58 | US$ 0,0035 | US$ 0,0037 |
| Resumo e perguntas | 30 | 8.108 / 111 | US$ 0,0065 | US$ 0,0236 |
| Delegação | 13 | 4.705 / 33 | US$ 0,0037 | US$ 0,0068 |

A consulta fica abaixo da meta de US$ 0,01 por pedido; o maior caso do resumo é o de uma Conversa longa,
como na F11.

## Comando

Com o Banco de negócio de desenvolvimento carregado (`uv run python -m scripts.load_business`), no
contêiner `agents`:

```bash
uv run --extra eval adk eval app/agents/assistente tests/eval/assistente/assistente.evalset.json --config_file_path tests/eval/assistente/test_config.json
uv run --extra eval adk eval app/agents/assistente tests/eval/assistente/delegacao.evalset.json --config_file_path tests/eval/assistente/test_config_delegacao.json
uv run --extra eval adk eval app/agents/assistente tests/eval/assistente/dados.evalset.json --config_file_path tests/eval/assistente/test_config_dados.json
```

O custo por caso sai dos tokens de cada execução em `app/agents/assistente/.adk/eval_history/`.

## O que a avaliação de dados confere

- A trajetória com os argumentos exatos de `consultar_dados` (Métrica, datas a partir de hoje em
  15/10/2026, `bruto`, comparação e filtro) e de `perguntar_periodo`; como o texto da resposta sai
  do código, o número certo vem dos argumentos certos.
- Pela rubrica, a recusa curta nos pedidos fora do catálogo, o "não entendi o que consultar" no "e
  em abril?" sozinho e nenhum número de vendas escrito pelo modelo.
- A ferramenta roda de verdade contra o Banco de negócio com os dados fixos, com a API do chat da
  avaliação e sem auditoria (plano, "Decisões"); o teste de integração
  `tests/integration/test_eval_business.py` prova esse caminho sem o modelo.
