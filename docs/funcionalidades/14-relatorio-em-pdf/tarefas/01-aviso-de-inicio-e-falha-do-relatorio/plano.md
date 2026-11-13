# Plano da F14-T01: Aviso de início e falha do Relatório na Conversa

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open`, quando o bot chama `report-failed` sem `report-started`, então
recebe 409 `report_not_started`; dado um Pedido com `report-started`, quando o bot chama
`report-failed` duas vezes, então a segunda devolve a mesma Mensagem, sem segunda linha em
`bot_actions`; quando, depois do `report-started`, o bot chama `reply`, então recebe 409
`request_closed`; e uma linha de `bot_actions` com `report_started`, `report_delivered` e
`report_failed` passa no CHECK, e uma com outro tipo é recusada pelo banco. A exclusão mútua com
`report_delivered` é provada na tarefa 02, que cria a rota; aqui, um `report_delivered` gravado
direto no banco faz o `report-failed` seguinte receber `request_closed`.

**Teste previsto:** e2e da API, `test/bot-report.e2e-spec.ts`, "report-failed sem report-started
responde 409 report_not_started", "report-failed repetido devolve a mesma Mensagem", "reply depois
do Aviso de início responde 409 request_closed", "report-failed depois de uma entrega responde 409
request_closed" e "o CHECK de bot_actions aceita as ações do Relatório".

### CA2

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open` da Ana num Canal, quando o bot chama `report-started` com o texto
do aviso, então responde 201 com a Mensagem do Agente com a marca, o `expires_at` do Pedido passa a
agora mais a validade do Pedido demorado (10 min) e a ação fica gravada; quando o Pedido teria
vencido pela validade comum (o `expires_at` original, de 2 min, já passou, simulado no banco
recuando o `created_at` e mantendo o novo `expires_at`), então o `report-failed` é aceito; num
Pedido já respondido por `reply`, `report-started` recebe `request_closed`; e um socket da Ana na
Conversa recebe `typing.stop` do bot depois do aviso.

**Teste previsto:** e2e da API, `test/bot-report.e2e-spec.ts`, "report-started grava o aviso com a
marca e estende a validade do Pedido", "uma ação depois da validade comum é aceita dentro da
validade nova" e "report-started num Pedido respondido responde 409 request_closed";
`test/realtime-bot-report.e2e-spec.ts`, "o Aviso de início emite o fim do digitando".

### CA3

**Marca:** teste HTTP

**Cenário:** Dado um Pedido da Ana com o Aviso de início, num Canal com a Ana e o Bruno, quando o
bot chama `report-failed`, então a Mensagem gravada tem a marca, o corpo
"@<usuário da Ana>, não consegui gerar o relatório." e a Menção à Ana em `mentions`; a Atividade da
Ana traz a Notificação de Menção dessa Mensagem, completa quando ela tem Permissão de dados e
bloqueada (`blocked: true`, corpo vazio) quando não tem; com `socket.io-client`, a Ana recebe o
`activity.unread` com `mention_count` 1 e o `message.created` da falha; o Bruno recebe o
`message.created` bloqueado, sem `activity.unread`; e, depois de cair e reconectar com o cursor
anterior, o Bruno recebe o reenvio da versão bloqueada.

**Teste previsto:** e2e da API, `test/bot-report.e2e-spec.ts`, "report-failed grava a falha com a
Menção a quem pediu" e "a Atividade de quem pediu traz a falha, completa com permissão e bloqueada
sem"; `test/realtime-bot-report.e2e-spec.ts`, "a falha chega a cada Membro na sua versão e quem
pediu recebe activity.unread" e "a reconexão reenvia a falha bloqueada".

### CA4

**Marca:** teste HTTP

**Cenário:** Dado um Pedido com o Aviso de início, quando o Worker chama `report-failed` com o
`CHAT_WORKER_TOKEN`, então responde 201; quando o Worker chama `report-started`, `reply`, `typing`
ou `messages` com o `CHAT_WORKER_TOKEN`, então responde 401 `invalid_bot_token`; `report-failed`
sem credencial ou com uma errada responde 401; e o bot com o `CHAT_BOT_TOKEN` também é aceito em
`report-failed`. A comparação em tempo constante é revisão humana do guard (mesma forma do
`BotTokenGuard`), e a variável no schema e no compose é conferida no diff.

**Teste previsto:** e2e da API, `test/bot-report.e2e-spec.ts`, "report-failed aceita o segredo do
Worker e o de bot", "o segredo do Worker é recusado nas outras rotas do bot" e "report-failed sem
credencial responde 401".

### CA5

**Marca:** revisão humana

**Cenário:** Quem revisa abre a página "Telas" do Figma e encontra a seção "Relatório em PDF (F14)",
com os frames `Conversa / Relatório / Aviso de início`, `Conversa / Relatório / Falha` e
`Conversa / Relatório / Relatório em andamento`, nos temas claro e escuro, montados com instâncias
dos componentes locais (MessageItem, AgentText) e os tokens do design system, desenhados antes do
código da tela.

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` com o bot criado, a Ana com Permissão de dados e o Bruno sem, num
Canal, em dois contextos do navegador, quando a Ana menciona o Agente e o bot grava, pelas rotas
`/v1/bot/.../report-started` e `/report-failed`, o aviso e a falha, então a Ana vê o aviso e a falha
com a Menção a ela destacada, e o Bruno vê as duas como Resposta bloqueada, sem recarregar; e a Ana
abre Atividade, vê a Notificação da falha e, ao ativá-la pelo teclado, cai na Mensagem da falha na
Conversa. Os testes HTTP de CA1 a CA4 completam o critério.

**Teste previsto:** Playwright, `e2e/agentes/relatorio-aviso-e-falha.spec.ts`, "o aviso e a falha
aparecem completos para quem tem permissão e bloqueados para a outra Pessoa" e "a Notificação da
falha leva à Mensagem", com os casos no `e2e/plano-de-testes-f14.md`.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre o `docs/lld.md` e encontra as três ações de bot do Relatório, a
credencial do Worker e as rotas `report-started` e `report-failed` como `existe`, e a
`report-delivered` ainda `planejada`.

## Contrato

### bot_actions · chat · alterada

- CHECK `bot_actions_action_type_check`: antes `"action_type" IN ('reply', 'question', 'task')`;
  depois `"action_type" IN ('reply', 'question', 'task', 'report_started', 'report_delivered',
  'report_failed')`. Escrito à mão na migração `AddReportBotActions`, e no `@Check` da entidade.

### agent_requests · chat · sem mudança de forma

O `expires_at` passa a ser reescrito pela ação `report_started` (agora + validade do Pedido
demorado). Nenhuma coluna muda.

### POST /v1/bot/requests/:id/report-started · nova

| Item | Descrição |
| --- | --- |
| Autenticação | `Authorization: Bearer <CHAT_BOT_TOKEN>`; o `CHAT_WORKER_TOKEN` é recusado |
| Parâmetros de caminho | `id`: id do Pedido (uuid; malformado é `request_not_found`) |
| Corpo da requisição | `{ body: string }`, obrigatório, com as regras do texto da Mensagem (`EditMessageDto`) |
| Resposta de sucesso | 201 `{ message: MessageResponse }`, com `business_data: true`; a repetição devolve 201 com a mesma Mensagem |
| Erros | 400 `validation_failed`; 401 `invalid_bot_token`; 404 `request_not_found`; 409 `request_closed` (Pedido encerrado ou já respondido); 410 `request_expired` |

### POST /v1/bot/requests/:id/report-failed · nova

| Item | Descrição |
| --- | --- |
| Autenticação | `Authorization: Bearer <CHAT_BOT_TOKEN>` ou `Bearer <CHAT_WORKER_TOKEN>` |
| Parâmetros de caminho | `id`: id do Pedido |
| Corpo da requisição | Nenhum (ignorado) |
| Resposta de sucesso | 201 `{ message: MessageResponse }`, com `business_data: true`, o corpo "@<usuário de quem pediu>, não consegui gerar o relatório." e `mentions` com quem pediu; a repetição devolve a mesma Mensagem |
| Erros | 401 `invalid_bot_token`; 404 `request_not_found`; 409 `report_not_started` (sem `report_started`); 409 `request_closed` (Pedido encerrado ou com `report_delivered`); 410 `request_expired` |

### Erro `report_not_started` · novo

Código estável novo no `ErrorCode`, com status 409 e o título "O Relatório não foi iniciado.".

### activity.unread · servidor → cliente · alterado

| Item | Descrição |
| --- | --- |
| Quem recebe | Antes: nunca por Mensagem de bot. Depois: as Pessoas mencionadas numa Mensagem de bot (hoje, só quem pediu, na falha e na entrega) |
| Carga | Sem mudança |

### message.created · servidor → cliente · sem mudança de forma

A Mensagem da falha chega com `mentions` preenchido; a de bot sem Menção segue com `mentions` vazio.

### Variável `CHAT_WORKER_TOKEN` · nova

No `env.schema.ts` da API do chat, string obrigatória e não vazia, como o `CHAT_BOT_TOKEN`; no
`compose.yaml`, `chat-api` recebe `dev-chat-worker-token`.

## Verificação do contrato

- CHECK de `bot_actions`: CA1.
- `report-started` 201, repetição, `request_closed`, extensão do `expires_at`: CA2; 401 com o
  segredo do Worker: CA4; 400, 404 e 410 seguem o caminho comum de `lockForAction` e do
  `EditMessageDto`, já provados nas rotas `reply` da F11, e não ganham teste novo.
- `report-failed` 201 com a Menção: CA3; repetição, `report_not_started` e `request_closed`: CA1;
  401 e os dois segredos: CA4.
- `activity.unread` à pessoa mencionada pela Mensagem de bot: CA3.
- `message.created` com `mentions` e na versão de cada Membro, e reenvio na reconexão: CA3.

## Decisões

- As rotas do Relatório ficam num controller próprio, `BotReportsController`, sob o mesmo prefixo
  `bot/requests/:requestId`, com o guard por rota: o `BotController` segue com o `BotTokenGuard` na
  classe, e assim recusa o segredo do Worker sem mudança.
- A conferência de token sai do `BotTokenGuard` para uma função `matchesBearer(header, digests)`
  em `bot/bearer-token.ts`, usada pelo `BotTokenGuard`, pelo `BotOrWorkerTokenGuard` (novo, aceita
  os dois segredos) e, na tarefa 02, pelo `WorkerTokenGuard`. Os SHA-256 comparados com
  `timingSafeEqual`, como hoje. O segredo do Worker errado devolve o mesmo
  `invalid_bot_token`: as rotas são todas `/v1/bot`, e um código a mais diria a quem tenta qual
  segredo existe.
- A regra de terminal fica no `once` do `BotActionsService`, por tipo: `report_delivered` e
  `report_failed` exigem `report_started` (senão `ReportNotStartedError`) e recusam a outra
  terminal com `request_closed`; os outros tipos seguem "já respondido → `request_closed`".
- A validade do Pedido demorado é a constante `LONG_AGENT_REQUEST_TTL_MS` (10 min) em
  `agent-request-values.ts`, gravada por `AgentRequestsService.extendForReport` dentro da transação
  da ação.
- A Mensagem de bot com Menção: `insertBotMessage` ganha a opção `mentionIds`, que grava as linhas
  de `message_mentions` e devolve as `MentionView`; o corpo da falha é montado no
  `BotActionsService` com o `@usuário` de quem pediu, lido pelo `PeopleService`.
- A Notificação de Menção de bot: em `MENTIONS_OF_PERSON` o filtro de autor passa de
  `message.author_person_id <> person.id` para `message.author_person_id IS DISTINCT FROM
  person.id`, para a Mensagem de bot (autor nulo) com Menção entrar no cálculo; a Conversa direta
  continua sem bot, porque `DIRECT_OF_MEMBER` não muda (bot não é Membro de Conversa direta e a
  regra da F11 vale ali).
- O `publishBotMessage` publica o `activity.unread` às Pessoas mencionadas, depois do
  `message.created`, como o envio faz.
- O `AgentText` passa a destacar as Menções da Mensagem (os `@usuário` de `mentions`), com o mesmo
  estilo da Menção no texto de uma Pessoa, como a spec pede em "Cliente (web)"; o resto do texto do
  Agente continua sem link.
- Os três frames do Figma são feitos antes do código da web; a recusa de Relatório em andamento é
  só frame aqui, porque quem a grava é a ferramenta da tarefa 04.

## Arquivos e interfaces

- `apps/chat-api/migrations/1794520000000-AddReportBotActions.ts`: troca o CHECK de `bot_actions`.
- `apps/chat-api/src/agent-requests/bot-action.entity.ts`: `BotActionType` com os três tipos e o
  `@Check` novo.
- `apps/chat-api/src/agent-requests/agent-request-values.ts`: `LONG_AGENT_REQUEST_TTL_MS`.
- `apps/chat-api/src/agent-requests/agent-requests.service.ts`: `extendForReport(request)` e
  `findActionTypes(requestId)`.
- `apps/chat-api/src/agent-requests/report-not-started.error.ts`: `ReportNotStartedError`.
- `apps/chat-api/src/common/errors/error-code.ts` e `problem-details.filter.ts`: `report_not_started`.
- `apps/chat-api/src/bot/bearer-token.ts`: `digest`, `matchesBearer`.
- `apps/chat-api/src/bot/bot-token.guard.ts`: usa `matchesBearer`.
- `apps/chat-api/src/bot/bot-or-worker-token.guard.ts`: `BotOrWorkerTokenGuard`.
- `apps/chat-api/src/bot/bot-reports.controller.ts`: `reportStarted`, `reportFailed`.
- `apps/chat-api/src/bot/bot-actions.service.ts`: `reportStarted(requestId, body)`,
  `reportFailed(requestId)`; regra de terminal no `once`.
- `apps/chat-api/src/bot/bot.module.ts`: registra o controller e o guard.
- `apps/chat-api/src/messages/messages.service.ts`: `insertBotMessage(..., { mentionIds })` e o
  `activity.unread` no `publishBotMessage`.
- `apps/chat-api/src/notifications/notification-finder.ts`: filtro de autor das Menções.
- `apps/chat-api/src/config/env.schema.ts` e `compose.yaml`: `CHAT_WORKER_TOKEN`.
- `apps/chat-api/test/support/test-env.ts` e `bot-routes.ts`: `TEST_WORKER_TOKEN`,
  `botRoutes.reportStarted`, `botRoutes.reportFailed`.
- `apps/chat-api/test/bot-report.e2e-spec.ts` e `test/realtime-bot-report.e2e-spec.ts`: novos.
- `apps/web/src/app/components/agent/agent-text.tsx` e `src/app/utils/agent-text.ts`: Menções.
- `apps/web/e2e/agentes/relatorio-aviso-e-falha.spec.ts` e `e2e/plano-de-testes-f14.md`: novos.

## Testes existentes que mudam

- Os testes da Atividade e de Mensagem de bot que afirmam "Mensagem de bot não gera Notificação"
  continuam valendo: a Mensagem de bot sem Menção segue fora. Nenhum muda.
- Testes de unidade de `agent-text` ganham o caso da Menção.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra as ações, a credencial e as rotas como `planejadas`,
pela spec. A passagem a `existe` entra no fim da tarefa (CA7).
