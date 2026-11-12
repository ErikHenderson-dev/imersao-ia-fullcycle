# Plano da F13-T04: Perguntar um número e receber a resposta

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de unidade

**Cenário:** Dado cada uma das seis Métricas e um período, quando o catálogo monta a consulta, então
o SQL compilado lê só as tabelas e colunas da Métrica, com o período e o status como parâmetros
ligados (nenhum valor no texto do SQL), sem coluna de contato (`email`, `phone`, `document`); o
faturamento usa `net_amount` e, com `bruto`, `gross_amount`; e o período de 01/03/2026 a 31/03/2026
vira o intervalo `[2026-03-01T03:00Z, 2026-04-01T03:00Z)` no fuso da empresa.

**Teste previsto:** unidade, `tests/unit/test_business_catalog.py`, "o SQL de cada Métrica não tem
coluna de contato nem valor literal" (parametrizado), "o bruto troca a coluna do faturamento" e "o
período vira o intervalo em UTC no fuso da empresa".

### CA2

**Marca:** teste de unidade

**Cenário:** Dado um SQL, quando a conferência de somente leitura o examina, então aceita o `SELECT`
de cada Métrica do catálogo e recusa `INSERT`, `UPDATE`, `DELETE`, duas instruções, `SELECT … INTO`,
`SELECT … FOR UPDATE`, uma CTE que altera dados e uma função fora da lista (`pg_sleep`).

**Teste previsto:** unidade, `tests/unit/test_business_readonly.py`, "aceita o SQL de cada Métrica"
e "recusa o que não é um SELECT só de leitura" (parametrizado).

### CA3

**Marca:** teste de integração

**Cenário:** Dado o `business_test` carregado e o tempo limite reduzido a 1 ms, quando a ferramenta
consulta, então grava "Não consegui responder." sem a marca e a auditoria tem `error`; e o banco
recebe a consulta pelo usuário `business_readonly` (a escrita falha, CA5 da F13-T03).

**Teste previsto:** integração, `tests/integration/test_business_query.py`, "estourar o tempo
limite dá não consegui com error na auditoria".

### CA4

**Marca:** teste de unidade

**Cenário:** Dado o resultado de uma Métrica, quando o código escreve a resposta, então sai
"Faturamento de março de 2026: R$ 1.234.567,89." seguido da linha "Considerado: faturamento
líquido, pedidos pagos, de 01/03/2026 a 31/03/2026, fuso America/Sao_Paulo."; a contagem sai como
inteiro com separador de milhar; o resultado vazio sai como "Nenhum pedido pago em março de 2026.";
e o lastro aceita o texto escrito pelo código e recusa um texto com um número que não está no
resultado nem nas datas, o que vira "Não consegui responder." com `lastro_blocked`.

**Teste previsto:** unidade, `tests/unit/test_business_answer.py`, "a resposta tem o número em pt-BR
e a linha do que foi considerado" (parametrizado pelas Métricas), "o resultado vazio é dito como
tal"; `tests/unit/test_business_lastro.py`, "aceita o texto da resposta" e "recusa um número sem
lastro"; integração, `tests/integration/test_business_query.py`, "um número sem lastro vira não
consegui com lastro_blocked".

### CA5

**Marca:** teste de integração

**Cenário:** Dado o Banco dos agentes migrado, quando a ferramenta responde, recusa ou falha, então
`business_queries` tem uma linha com o `request_id`, quem pediu, a Conversa, a pergunta, os
parâmetros, o SQL e o desfecho, sem o valor do resultado; e, com a gravação da auditoria falhando,
o Pedido termina com o "não consegui" e nenhuma resposta com número.

**Teste previsto:** integração, `tests/integration/test_business_query.py`, "a resposta grava a
auditoria sem o resultado" e "a falha da auditoria termina em não consegui".

### CA6

**Marca:** teste de integração

**Cenário:** Dado um Pedido sem Permissão de dados, quando a ferramenta é chamada, então a API do
chat falsa recebe a `reply` "Você não tem acesso a dados de negócio. Peça a permissão a quem opera a
instalação." sem `business_data`, a auditoria tem `no_permission` com `sql` nulo e o Banco de
negócio não é consultado; com a permissão, a `reply` tem o número e `business_data: true`, e o
Pedido termina sem outra `reply`.

**Teste previsto:** integração, `tests/integration/test_business_query.py`, "sem Permissão de dados
grava a recusa e não consulta" e "cada Métrica responde o número calculado à mão" (parametrizado,
com `business_data`).

### CA7

**Marca:** revisão humana

**Cenário:** Quem revisa abre `instructions.py` e encontra: a recusa curta com as três capacidades
(resumir, delegar e responder números de vendas) e o que dá para perguntar; a lista do catálogo com
o que cada Métrica significa; as regras de período (datas a partir de hoje, mês sem ano é o mais
recente já iniciado); que a Mensagem citada nunca entra numa consulta; e "Hoje é dd/mm/aaaa" no fim,
vindo do estado (a data no fuso da empresa calculada de `requested_at`), sem a Permissão de dados.
O teste de unidade "o estado traz a data de hoje no fuso da empresa" prova a data.

### CA8

**Marca:** teste de integração

**Cenário:** Dado o app real com o modelo real, o `business_test` carregado e a API do chat falsa,
quando chega o Pedido "@assistente quanto faturamos em março de 2026?" de quem tem Permissão de
dados, então a API falsa recebe uma `reply` com `business_data: true` e o faturamento de março
calculado à mão, e a auditoria tem `answered`. Os testes de unidade de CA1, CA2 e CA4 e os de
integração de CA3, CA5 e CA6 completam o critério.

**Teste previsto:** integração, `tests/integration/test_request_business.py`, "a pergunta de
faturamento grava a resposta com a marca".

### CA9

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` conectado, o Banco de negócio de desenvolvimento carregado, a Ana
com Permissão de dados e o Bruno sem, num Canal, quando a Ana envia "@assistente quanto faturamos em
março de 2026?", com o modelo real, então a Ana vê "Faturamento de março de 2026: R$ …" e a linha
"Considerado: …", e o Bruno vê a Resposta bloqueada, sem recarregar.

**Teste previsto:** Playwright, `e2e/agentes/consulta-a-dados.spec.ts`, "a pergunta de faturamento
responde com o número para quem tem permissão e bloqueada para o outro", com o caso no
`e2e/plano-de-testes-f13.md`.

### CA10

**Marca:** documento

**Cenário:** Quem revisa abre o LLD e encontra `app/business/` (catálogo, consulta, lastro e
conferência), o pglast em "Bibliotecas", `business_queries` em "Dados" e a regra da consulta em
"Estados e regras" como `existe`.

## Contrato

### POST /v1/bot/requests/:id/reply (cliente do Serviço de agentes) · alterada

O `ChatApiClient.reply` passa a mandar `business_data` (F13-T02, rota já aceita). A rota não muda.

### business_queries · agents · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | não | — | UUID v7, gerado na aplicação |
| `request_id` | `uuid` | não | — | o identificador do Pedido |
| `requester_id` | `uuid` | não | — | quem pediu |
| `conversation_id` | `uuid` | não | — | — |
| `question` | `text` | não | — | o texto do Pedido |
| `params` | `jsonb` | sim | — | os parâmetros da ferramenta |
| `sql` | `text` | sim | — | o SQL compilado, com os parâmetros como `$n`, sem os valores do resultado |
| `outcome` | `text` | não | — | um dos desfechos da spec |
| `created_at` | `timestamptz` | não | `now()` | — |

- Chave primária `id`; índice `business_queries_request_id_idx (request_id)`.
- `CHECK` `business_queries_outcome_check` (`outcome IN ('answered', 'no_permission',
  'not_found', 'ambiguous_name', 'too_generic', 'lastro_blocked', 'error')`), declarado na `Table`
  e na migração do Alembic.

## Verificação do contrato

- `reply` com `business_data`: CA6 e CA8.
- `business_queries`: as colunas gravadas, CA5; `no_permission` com `sql` nulo, CA6; `error`, CA3;
  `lastro_blocked`, CA4; `answered`, CA8. Os desfechos de nome (`not_found`, `ambiguous_name`,
  `too_generic`) são gravados pela F13-T05. O `CHECK` fica como guarda: o código só grava os
  desfechos do tipo `Outcome`.

## Decisões

- A ferramenta desta tarefa é `consultar_dados(metrica, inicio, fim, bruto=False)`; o filtro por
  nome e a comparação entram na F13-T05, que acrescenta os parâmetros opcionais.
- A orquestração da ferramenta mora em `app/business/consult.py` (`consult(...)`), e a função do
  ADK em `tools.py` só a chama, como `delegar_tarefa` chama `delegate`.
- O Banco de negócio e a auditoria chegam à ferramenta por um `ContextVar` (`CURRENT_BUSINESS`),
  como a API do chat: `ExecutionDeps` ganha `business: BusinessStore`, com o motor só leitura
  (`statement_timeout` na conexão, pelo `server_settings` do asyncpg) e o motor do Banco dos agentes
  do app. Fora de um Pedido, a ferramenta devolve o erro "só funciona dentro de um Pedido".
- Cada Métrica é uma consulta que devolve o valor e a quantidade de linhas da base (pedidos pagos,
  clientes novos ou pedidos do período ativo); com a base vazia, o resultado é vazio e o texto diz
  isso, sem número (o ticket médio nunca divide por zero).
- "Clientes ativos" conta os clientes distintos com pedido pago nos 90 dias até o fim do período, e a
  linha do que foi considerado mostra as datas da janela, que entram no conjunto do lastro.
- O lastro aceita, além dos números do resultado, o dia, o mês e o ano de cada data citada na
  linha; os números do texto são lidos pelo padrão pt-BR (`1.234.567,89`) e comparados como
  `Decimal`.
- Os parâmetros inválidos (Métrica fora do catálogo, data fora de ISO, início depois do fim, `bruto`
  fora do faturamento) voltam ao modelo como `erro`, sem consulta e sem auditoria: a auditoria
  registra consultas e recusas, e nada chegou ao banco.
- As falhas da consulta (tempo limite, recusa da conferência) e o lastro gravam "Não consegui
  responder." sem a marca, porque não há número.
- A auditoria é gravada antes da `reply`; se a gravação falha, a exceção sobe, e o fim do Pedido
  grava o "não consegui" geral, como em qualquer falha da ferramenta.
- O desfecho do Pedido no log ganha `business`, e a marca `ANSWERED_BY_TOOL` encerra a vez do modelo,
  como a pergunta e a Tarefa.
- A `business_queries` entra nos metadados do Banco dos agentes (`REGISTRY_METADATA`), para o
  Alembic autogerar e incluí-la.
- O estado do Pedido ganha `BUSINESS_TODAY` (ISO, no fuso `BUSINESS_TIME_ZONE`), que as instruções
  mostram como "Hoje é 15/10/2026 (quinta-feira)".
- O caso `fora_dados` do evalset da F11 deixa de esperar a recusa; ele é refeito na F13-T07, dona da
  avaliação.

## Arquivos e interfaces

- `app/business/catalog.py`: `Metric`, `METRICS`, `Period`, `query_for(metric, period, gross)`.
- `app/business/readonly.py`: `assert_read_only(sql)`, `NotReadOnlyError`.
- `app/business/answer.py`: `format_money`, `format_count`, `answer_text(result)`,
  `NAO_CONSEGUI_RESPONDER`, `SEM_PERMISSAO`.
- `app/business/lastro.py`: `numbers_in(text)`, `has_lastro(text, allowed)`.
- `app/business/db.py`: `BusinessStore`, `build_business_store(settings, agents_engine)`.
- `app/business/audit.py`: `business_queries`, `record(...)`.
- `app/business/consult.py`: `consult(client, tool_context, metrica, inicio, fim, bruto)`.
- `app/agents/assistente/tools.py`, `agent.py`, `instructions.py`.
- `app/agent_requests/context.py` (`BUSINESS_TODAY`), `execution.py` (estado, desfecho
  `business`, `ExecutionDeps.business`), `app/chat_api.py` (`reply(..., business_data=False)`),
  `app/fast_api_app.py`, `migrations/env.py`, `migrations/versions/0002_business_queries.py`.
- `tests/unit/test_business_catalog.py`, `test_business_readonly.py`, `test_business_answer.py`,
  `test_business_lastro.py`, `test_request_parts.py` (a data de hoje).
- `tests/integration/conftest.py` (a API falsa guarda `business_data`; o app com o Banco de negócio de
  teste), `tests/integration/test_business_query.py`, `tests/integration/test_request_business.py`.
- Web: `e2e/agentes/consulta-a-dados.spec.ts`, `e2e/plano-de-testes-f13.md`.

## Testes existentes que mudam

- O caso `fora_dados` da avaliação: passa a ser uma consulta, refeita na F13-T07; a avaliação fica
  fora da Verificação completa.
- A API do chat falsa dos testes de integração passa a guardar o `business_data` da `reply`.

## Mudança de dados

Nenhuma além da migração da `business_queries`.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra `app/business/`, o pglast, a `business_queries` e os
valores da consulta como `planejados`. No fim da tarefa, passam a `existe` pela skill `lld`.
