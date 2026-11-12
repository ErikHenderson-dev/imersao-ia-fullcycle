# Avaliação do assistente com o Relatório

2026-11-12 · F14-T07 · Critério: brief, "Qualidade do agente" (≥ 98% da avaliação completa),
"Número errado entregue" (meta 0) e "Custo por pedido"

**Resultado parcial: o evalset do Relatório passou inteiro (18 de 18), com o `gemini-3.6-flash` no
raciocínio mínimo. A reavaliação dos outros três evalsets (73 casos, com as instruções novas) parou
no `402 RESOURCE_EXHAUSTED` da chave ("prepayment credits are depleted") e fica pendente até o
crédito voltar.**

| Evalset | Configuração | Casos | Aprovados | Situação |
| --- | --- | --- | --- | --- |
| `relatorio.evalset.json` (Relatório em PDF, F14) | `test_config_relatorio.json` | 18 | 18 | válido |
| `assistente.evalset.json` (resumo e perguntas) | `test_config.json` | 30 | — | interrompido pelo 402 |
| `delegacao.evalset.json` (delegação) | `test_config_delegacao.json` | 13 | — | interrompido pelo 402 |
| `dados.evalset.json` (consulta) | `test_config_dados.json` | 30 | — | interrompido pelo 402 |

Os números brutos da rodada interrompida (27/30, 3/13 e 1/29) não medem o Agente: o log de cada uma
traz o 402 em quase todos os casos, e nenhum caso reprovado registrou uma trajetória ou uma rubrica
avaliada contra uma resposta real do modelo. A última avaliação válida desses três evalsets é a da
F13-T07 (72 de 73).

## O que muda nos casos antigos

As instruções ganharam a seção "Relatório em PDF" e a recusa curta ganhou uma frase sobre o
Relatório. Os casos da F11 a F13 conferem a recusa por rubrica, e não pelo texto exato, então não
mudam; a reavaliação com o crédito de volta confirma isso.

## Custo do Relatório

Pelo `token_usage_v1`, com o preço da F11 (US$ 0,75 por milhão de tokens de entrada e US$ 3,75 por
milhão de saída):

| Evalset | Casos | Tokens por caso, em média (entrada / saída) | Custo médio por caso | Maior caso |
| --- | --- | --- | --- | --- |
| Relatório | 18 | 5.883 / 69 | US$ 0,0047 | US$ 0,0085 (`rel_vendedora`) |

Abaixo da meta de US$ 0,01 por pedido. O Worker não chama o modelo: a entrega não soma custo.

## Comando

Com o Banco de negócio de desenvolvimento carregado (`uv run python -m scripts.load_business`), no
contêiner `agents`:

```bash
uv run --extra eval adk eval app/agents/assistente tests/eval/assistente/relatorio.evalset.json --config_file_path tests/eval/assistente/test_config_relatorio.json
uv run --extra eval adk eval app/agents/assistente tests/eval/assistente/assistente.evalset.json --config_file_path tests/eval/assistente/test_config.json
uv run --extra eval adk eval app/agents/assistente tests/eval/assistente/delegacao.evalset.json --config_file_path tests/eval/assistente/test_config_delegacao.json
uv run --extra eval adk eval app/agents/assistente tests/eval/assistente/dados.evalset.json --config_file_path tests/eval/assistente/test_config_dados.json
```

## O que a avaliação do Relatório confere

- A trajetória com os argumentos exatos de `gerar_relatorio` (as datas a partir de hoje em
  15/10/2026, o mês, o trimestre, o ano, o intervalo, o mês em andamento e o filtro com o nome como
  está no pedido), de `perguntar_periodo` sem período e de `consultar_dados` numa pergunta de número
  que não pede Relatório.
- Pela rubrica, a recusa curta (que agora diz o que o Relatório traz) nos pedidos com ranking, série
  mês a mês, gráfico, contato e alteração, e nenhum número escrito pelo modelo.
- A ferramenta roda de verdade até o aviso, contra o Banco de negócio com os dados fixos, com a API
  do chat da avaliação e a fila em memória (plano, "Decisões"); o teste de integração
  `tests/integration/test_eval_business.py` prova esse caminho sem o modelo. O conteúdo do PDF é
  conferido pelos testes de integração do Worker contra o gabarito.
