# Plano da F14-T07: Avaliação, medição e acessibilidade do Relatório

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa lê a seção "Decisões" deste plano e encontra como `gerar_relatorio` roda no
`adk eval` até o aviso, sem Worker, decidido a partir do MCP `adk-docs` ("Types of callbacks",
"Before Tool Callback": devolver `None` deixa a ferramenta rodar; "Evaluation Criteria": a
trajetória com os argumentos e as rubricas).

### CA2

**Marca:** documento

**Cenário:** Quem revisa abre `tests/eval/assistente/relatorio.evalset.json` e
`test_config_relatorio.json` e encontra cerca de 15 casos: pedidos de Relatório com variações de
escrita, com e sem filtro, com período explícito e em andamento; sem período (pergunta com as
Respostas prontas); nome repetido e não encontrado; sem Permissão de dados; Relatório com lista,
ranking, série, gráfico, contato e alteração (recusa curta); e robustez (pergunta de número sem
pedir Relatório, instrução para incluir contatos ou SQL, Relatório dentro de um resumo ou
delegação), cada um com os argumentos esperados de `gerar_relatorio` na trajetória e a rubrica do
juiz.

### CA3

**Marca:** documento

**Cenário:** Quem revisa abre `avaliacao.md` na pasta desta tarefa e encontra os quatro evalsets
(resumo, delegação, consulta e Relatório), com os casos aprovados de cada um, o total ≥ 98% e o
custo médio e o maior custo por caso de cada evalset, a partir do `token_usage_v1`.

### CA4

**Marca:** documento

**Cenário:** Quem revisa abre `medicao-p95.md` na pasta desta tarefa e encontra o p50, o p95 e o
máximo do aviso (meta ≤ 5 s) e da entrega (meta ≤ 60 s), da Mensagem enviada até a do Agente
aparecer para quem pediu, com o modelo padrão, o número de amostras e o comando de
`e2e/medicao/relatorio-p95.medicao.ts`.

### CA5

**Marca:** teste no Playwright

**Cenário:** Dado um Canal com uma entrega do Relatório completa (Ana, com Permissão de dados) e uma
bloqueada (Bruno, sem), quando o axe roda em cada uma das duas páginas, nos temas claro e escuro,
então não há violações; e a validação visual das telas da entrega (T02) e do PDF (T03), já
registrada nas pastas delas, é conferida de novo com a versão final e registrada em
`validacao-visual.md` nesta pasta.

**Teste previsto:** Playwright, `e2e/acessibilidade/relatorio-sem-violacoes.spec.ts`, "a Conversa
com a entrega completa e a bloqueada passa no axe nos dois temas".

### CA6

**Marca:** revisão humana

**Cenário:** Quem revisa abre `roteiro-lighthouse.md` nesta pasta e encontra o passo a passo para
uma pessoa medir a nota 100 de Acessibilidade do Lighthouse nos dois temas, na Conversa com uma
entrega completa e uma bloqueada, com o espaço para registrar o resultado.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre o `docs/lld.md` e encontra a avaliação do `assistente` com o quarto
evalset (Relatório) na linha "Avaliação dos agentes", ou o `apps/agents/AGENTS.md` com ele, conforme
o dono do fato.

## Contrato

O contrato não muda.

## Verificação do contrato

Nenhum item de contrato.

## Decisões

- **A ferramenta na avaliação**, decidida com o MCP `adk-docs`: o `before_tool_callback` da
  avaliação (`app/eval_fixtures.py`) já deixa `consultar_dados` rodar devolvendo `None` e trocando a
  API do chat e a auditoria pelas da avaliação. `gerar_relatorio` entra no mesmo caminho: a API do
  chat da avaliação ganha `report_started` e `report_failed`, que guardam o aviso e a falha em
  `eval_resposta`, e a fila do Relatório é uma fila em memória da avaliação (`EvalReportQueue`), com
  a trava e o enfileiramento que só guardam a carga no estado (`eval_relatorio`). Sem Worker: a
  avaliação confere até o aviso, e o PDF é conferido pelos testes de integração do Worker contra o
  gabarito (spec, "Decisões de teste").
- O evalset do Relatório usa a mesma configuração da consulta (`tool_trajectory_avg_score`
  IN_ORDER 1.0 com os argumentos e `rubric_based_final_response_quality_v1`), com `business_today`
  15/10/2026, como o da F13: os argumentos esperados (datas, filtro) são exatos.
- A recusa curta mudou na tarefa 04 (ganhou o Relatório): os casos da F11 a F13 que conferem a
  recusa por rubrica seguem valendo; se algum conferir o texto exato, ele é atualizado nesta tarefa.
- A medição usa o mesmo modelo de `e2e/medicao/consulta-p95.medicao.ts`: 10 Pedidos de Relatório,
  cada um num Canal novo e por uma Pessoa nova (a trava é por Pessoa), com o Worker rodando; mede o
  aviso e a entrega na mesma amostra.
- A checagem de acessibilidade usa o `expectNoViolationsInBothThemes`, com o bot agindo pelas rotas,
  sem o modelo.

## Arquivos e interfaces

- `apps/agents/app/eval_fixtures.py`: `gerar_relatorio` no caminho da avaliação,
  `EvalChatApi.report_started`/`report_failed`, `EvalReportQueue`.
- `apps/agents/tests/eval/assistente/relatorio.evalset.json` e `test_config_relatorio.json`.
- `apps/agents/tests/integration/test_eval_business.py` (ou um arquivo novo): o caminho da avaliação
  do Relatório sem o modelo.
- `apps/agents/AGENTS.md`: o quarto evalset.
- `apps/web/e2e/medicao/relatorio-p95.medicao.ts`.
- `apps/web/e2e/acessibilidade/relatorio-sem-violacoes.spec.ts`.
- Registros nesta pasta: `avaliacao.md`, `medicao-p95.md`, `validacao-visual.md`,
  `roteiro-lighthouse.md`.

## Testes existentes que mudam

Os casos de avaliação da F11 a F13 que conferirem o texto exato da recusa curta, se houver.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano.
