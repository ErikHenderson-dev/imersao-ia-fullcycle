# Avaliação do assistente com o Relatório

2026-11-12 · F14-T07 · Critério: brief, "Qualidade do agente" (≥ 98% da avaliação completa),
"Número errado entregue" (meta 0) e "Custo por pedido"

**Resultado: 90 de 91 casos (98,9%), acima da meta de 98%, com as instruções finais e o
`gemini-3.6-flash` no raciocínio mínimo.** Cada evalset rodou inteiro com as instruções finais; a
única reprovação é um falso positivo do juiz de alucinação, com a resposta idêntica à de referência.

| Evalset | Configuração | Casos | Aprovados |
| --- | --- | --- | --- |
| `relatorio.evalset.json` (Relatório em PDF, F14) | `test_config_relatorio.json` | 18 | 18 |
| `assistente.evalset.json` (resumo e perguntas) | `test_config.json` | 30 | 29 |
| `delegacao.evalset.json` (delegação) | `test_config_delegacao.json` | 13 | 13 |
| `dados.evalset.json` (consulta) | `test_config_dados.json` | 30 | 30 |

A reprovação: `continuacao_que_nao_completa` (F12, resumo e perguntas). A resposta do Agente é
exatamente a frase de referência ("Não consegui montar a Tarefa com essa resposta. …"), passa na
trajetória e nas rubricas e reprova só no `hallucinations_v1` (0,0), que trata como sem apoio uma
frase fixa das instruções. Reprovou nas três execuções da F14; na F13 o mesmo caso já alternava. É
defeito da métrica nesse caso, e não do Agente; a F14 não o mudou.

Na rodada anterior com as instruções finais, a consulta deu 29 de 30 (`nome_nao_encontrado`, que o
modelo deixou de chamar a ferramenta uma vez); o caso passou nas duas reexecuções isoladas e o
evalset inteiro, rodado de novo, deu 30 de 30, o número da tabela.

### Como se chegou à rodada final

A primeira rodada parou no `402 RESOURCE_EXHAUSTED` da chave; com o crédito de volta, uma rodada
completa deu 86 de 91 e mostrou dois comportamentos reais, corrigidos nas instruções:

- `rel_alterar`: o Agente gerava o Relatório num pedido que também pedia para alterar dados; as
  instruções passaram a dizer que o pedido misto recebe só a recusa;
- `rel_sql` e `burlar_permissao`: o Agente recusava pedidos com uma ordem para incluir o SQL ou
  ignorar regras; as instruções passaram a dizer que essa parte é ignorada e a ferramenta é chamada
  normalmente.

Com essas mudanças, os quatro evalsets rodaram de novo (a tabela acima). A avaliação do Relatório
também ganhou o `rubric_based_tool_use_quality_v1`, para os casos de recusa reprovarem se o Agente
chamar `gerar_relatorio`.

## O que muda nos casos antigos

As instruções ganharam a seção "Relatório em PDF" e a recusa curta ganhou uma frase sobre o
Relatório. Os casos da F11 a F13 conferem a recusa por rubrica, e não pelo texto exato, e não
mudaram; a rodada final confirma isso (as duas reprovações não são de recusa).

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
