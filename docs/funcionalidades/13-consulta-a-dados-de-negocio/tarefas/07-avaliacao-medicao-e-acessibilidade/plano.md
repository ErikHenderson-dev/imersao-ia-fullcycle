# Plano da F13-T07: Avaliação, medição e acessibilidade da consulta

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa lê a seção "Decisões" deste plano e encontra a forma de rodar
`consultar_dados` contra o Banco de negócio real no `adk eval`, decidida pela documentação do ADK
consultada pelo MCP `adk-docs` ("Types of callbacks", `before_tool_callback`; "Environment simulation
for evaluations"), e o "hoje" do caso em 15/10/2026.

### CA2

**Marca:** teste de unidade

**Cenário:** Dado o evalset `dados.evalset.json`, quando o teste o lê, então ele tem 30 casos com
`session_input.state` de avaliação (o "hoje" em 15/10/2026 e a Permissão de dados de cada caso),
cobrindo as categorias da spec (Métrica com variações de escrita, filtro, comparação, sem período,
nome repetido, não encontrado, genérico demais, sem permissão, fora do catálogo e robustez), e uma
configuração própria (`test_config_dados.json`); e o caso `fora_dados` do evalset da F11 espera uma
chamada de `consultar_dados`. Com o estado de avaliação, o callback deixa `consultar_dados` rodar
com o Banco de negócio e a API do chat da avaliação, e a resposta gravada pela ferramenta fica no
estado do caso.

**Teste previsto:** unidade, `tests/unit/test_eval_fixtures_business.py`, "o evalset de dados tem os
30 casos das categorias da spec", "o caso fora_dados espera a consulta" e "o callback deixa a
consulta rodar com a API do chat da avaliação".

### CA3

**Marca:** documento

**Cenário:** Quem revisa abre `avaliacao.md` nesta pasta e encontra o resultado da avaliação completa
(os 73 casos de resumo, delegação e consulta), a taxa de aprovação contra a meta de 98% e o custo por
caso, ou o registro de que ela não pôde rodar e por quê.

### CA4

**Marca:** documento

**Cenário:** Quem revisa abre `medicao-p95.md` nesta pasta e encontra o p95 da consulta completa, da
Mensagem enviada até a resposta aparecer, com o modelo padrão, medido por
`e2e/medicao/consulta-p95.medicao.ts`, ou o registro de que a medição não pôde rodar e por quê.

### CA5

**Marca:** teste no Playwright

**Cenário:** Dado uma Conversa com uma resposta completa e uma bloqueada, vista por quem não tem
Permissão de dados, quando o axe roda nos dois temas, então não há violações.

**Teste previsto:** Playwright, `e2e/acessibilidade/resposta-bloqueada-sem-violacoes.spec.ts`
(F13-T02), rodado de novo nesta tarefa.

### CA6

**Marca:** documento

**Cenário:** Quem revisa abre `roteiro-lighthouse.md` nesta pasta e encontra o passo a passo para uma
pessoa medir a nota 100 de Acessibilidade do Lighthouse nos dois temas, na Conversa com uma resposta
completa e uma bloqueada, com o lugar para registrar o resultado.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre o LLD e encontra a avaliação da consulta em "Estrutura do código"
(linha "Avaliação dos agentes") e o `apps/agents/AGENTS.md` com o terceiro evalset.

## Contrato

O contrato não muda.

## Verificação do contrato

Nenhum item.

## Decisões

- **Como `consultar_dados` roda no `adk eval` (CA1).** Pela documentação do ADK, um
  `before_tool_callback` que devolve `None` deixa a ferramenta rodar, e um dicionário a substitui. O
  `fixture_tool_callback` do projeto, que já responde às outras ferramentas, passa a tratar
  `consultar_dados` e `perguntar_periodo`: com `eval_fixture` no estado, ele põe nos `ContextVar`s a
  API do chat da avaliação (`EvalChatApi`, que não grava, e guarda a última resposta no estado) e um
  `BusinessStore` da avaliação, com o motor só leitura de `BUSINESS_DATABASE_URL` (o Banco de
  negócio de desenvolvimento, com os dados fixos) e sem auditoria, e devolve `None`: a ferramenta de
  produção roda inteira. Descartada a simulação de ambiente do ADK (`EnvironmentSimulationFactory`),
  que troca o resultado por uma resposta injetada ou gerada pelo modelo, quando a spec pede o número
  real dos dados fixos.
- A auditoria passa por `BusinessStore.record`, que a avaliação sobrescreve sem gravar: o
  `adk eval` não tem o Banco dos agentes.
- O "hoje" dos casos é 15/10/2026 (`business_today` e `requested_at` no `session_input.state`), e
  cada caso diz a Permissão de dados (`data_access`) de quem pede.
- As checagens exatas entram como argumentos esperados na trajetória (`tool_trajectory_avg_score`,
  `IN_ORDER`, com os argumentos), e o texto das recusas e das perguntas, como rubrica do juiz; como
  o texto da resposta sai do código, o número não precisa de rubrica: ele vem dos argumentos.
- Os casos do evalset da F11 que esperavam a recusa antiga passam a esperar a recusa com as três
  capacidades, e o `fora_dados` passa a ser uma consulta de faturamento de outubro.
- A avaliação, a medição e o Lighthouse dependem do modelo real ou de uma pessoa; com a chave do
  Gemini sem crédito (402), os registros dizem que não rodaram, e a tarefa fecha com a pendência,
  como na F12.

## Arquivos e interfaces

- `apps/agents/app/eval_fixtures.py`: `consultar_dados` e `perguntar_periodo` no callback;
  `EvalChatApi.reply` e `question` com `business_data`; `EvalBusinessStore`.
- `apps/agents/app/business/db.py`: `BusinessStore.record`; `consult.py` grava por ela.
- `apps/agents/tests/eval/assistente/dados.evalset.json`, `test_config_dados.json`;
  `assistente.evalset.json` (o `fora_dados` e a recusa nova).
- `apps/agents/tests/unit/test_eval_fixtures_business.py`.
- `apps/web/e2e/medicao/consulta-p95.medicao.ts`.
- Nesta pasta: `avaliacao.md`, `medicao-p95.md`, `roteiro-lighthouse.md`.
- `apps/agents/AGENTS.md`, seção "Avaliação".

## Testes existentes que mudam

- O `fora_dados` e os casos de recusa do evalset da F11 (a recusa mudou na F13-T04).

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano. No fim da tarefa, o LLD ganha o evalset de dados na linha "Avaliação dos
agentes" pela skill `lld`.
