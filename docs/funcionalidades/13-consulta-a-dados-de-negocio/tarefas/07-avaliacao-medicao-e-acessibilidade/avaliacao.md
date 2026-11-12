# Avaliação do assistente com a consulta

2026-11-12 · F13-T07 · Critério: brief, "Qualidade do agente" (≥ 98% da avaliação completa),
"Número errado entregue" (meta 0) e "Custo por pedido"

**Resultado: não rodou.** A chave do Gemini (`GEMINI_API_KEY`, no `apps/agents/.env`) responde
`402 RESOURCE_EXHAUSTED` ("Your prepayment credits are depleted"), no agente e no juiz. O primeiro
caso tentado (`dados.evalset.json:fat_marco`) falhou na primeira chamada ao modelo.

| Evalset | Configuração | Casos | Aprovados |
| --- | --- | --- | --- |
| `assistente.evalset.json` (resumo da F11, perguntas da delegação e o `fora_dados`, agora consulta) | `test_config.json` | 30 | não rodou |
| `delegacao.evalset.json` (casos que chamam `delegar_tarefa`) | `test_config_delegacao.json` | 13 | não rodou |
| `dados.evalset.json` (consulta a Dados de negócio) | `test_config_dados.json` | 30 | não rodou |

## Como rodar quando a chave tiver crédito

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
