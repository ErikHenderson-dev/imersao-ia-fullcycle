# Plano da F12-T03: Notificações de Tarefa

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado a Ana delegando ao Bruno, quando a ação `task` grava a Tarefa, então há uma
Notificação `received` do Bruno; quando o Bruno conclui e depois reabre, há uma `completed` e uma
`reopened` da Ana. Delegar a si mesma, e concluir e reabrir a própria Tarefa, não gravam nenhuma. A
ação `task` repetida não grava outra.

**Teste previsto:** e2e da API, `test/task-notifications.e2e-spec.ts`, "a Tarefa notifica o
Responsável, e a conclusão e a reabertura, quem delegou" e "ninguém é notificado da própria ação".

### CA2

**Marca:** teste HTTP

**Cenário:** Dado as Notificações do CA1 e uma Menção ao Bruno, quando o Bruno lista
`GET /v1/activity?kind=all`, então os itens de Tarefa vêm misturados aos de Menção pela ordem dos
ids, com `notification` (`id`, `kind`, `read` falso), `task` e `actor` (a Ana); em `kind=mentions`
eles não vêm. `GET /v1/activity/unread` traz `task_count` 1 e o `total_count` somado; com o teto, a
contagem para em 100.

**Teste previsto:** e2e da API, `test/task-notifications.e2e-spec.ts`, "a Atividade traz as
Notificações de Tarefa na aba Todas" e "o task_count entra no total".

### CA3

**Marca:** teste HTTP

**Cenário:** Quando o Bruno marca a Notificação de Tarefa como lida, então recebe 204, a lista a
traz com `read` verdadeiro e o `task_count` cai; marcar de novo responde 204; a Ana (que não é a
destinatária) e um id inexistente recebem 404 `not_found`. Quando o Bruno marca tudo como lido com
o `task_notification_id` da mais nova, todas as Notificações anteriores, de todos os tipos, ficam
lidas; com o id de uma Notificação de outra Pessoa, 404 `message_not_found`.

**Teste previsto:** e2e da API, `test/task-notifications.e2e-spec.ts`, "marca uma Notificação de
Tarefa como lida", "só o destinatário marca" e "marcar tudo com uma Notificação de Tarefa".

### CA4

**Marca:** teste HTTP

**Cenário:** Com o servidor real, quando a ação `task` cria a Tarefa, então o Bruno recebe
`task.created` com `notification` (`id`, `kind: "received"`) e a Ana com `notification` nula, e o
Bruno recebe `activity.unread` com `task_count` 1; quando o Bruno conclui, a Ana recebe
`task.updated` com `notification` `completed` e o Bruno com nula.

**Teste previsto:** e2e da API, `test/realtime-tasks.e2e-spec.ts`, "a Notificação vai só a quem
recebe".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dado o Bruno em Atividade → Todas, quando a Ana delega a ele, então o item "Ana Souza
delegou uma Tarefa a você", com o título, aparece não lido, e o contador da aba Tarefas e o do rail
sobem; clicar nele abre a aba Tarefas com a Tarefa em destaque, e o item fica lido.

**Teste previsto:** Playwright, `e2e/atividade/notificacao-de-tarefa.spec.ts`, "a Notificação de
Tarefa chega, conta e abre a Tarefa".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado o Bruno numa Conversa, quando a Ana delega a ele, então o Alerta "Ana Souza
delegou uma Tarefa a você" aparece; quando o Bruno conclui, a Ana, noutra Conversa, vê o Alerta
"Bruno Lima concluiu uma Tarefa". Com a aba Tarefas aberta e em foco, não há Alerta.

**Teste previsto:** Playwright, `e2e/atividade/notificacao-de-tarefa.spec.ts`, "o Alerta da Tarefa
recebida e da concluída" e "sem Alerta com a aba Tarefas aberta".

### CA7

**Marca:** revisão humana

**Cenário:** Quem revisa abre o Figma e encontra, nos dois temas, o item de Notificação de Tarefa
(recebida, concluída e reaberta) na lista de Atividade e no Alerta, feito antes do código.

### CA8

**Marca:** teste de unidade

**Cenário:** O título de cada tipo de Notificação de Tarefa, a leitura pelo `read` e pela marca, e a
decisão de Alerta para os eventos de Tarefa (sem Notificação, no reenvio, com a aba Tarefas aberta e
em foco). Os testes HTTP e de Playwright de CA1 a CA6 completam o critério, inclusive duas
conclusões simultâneas com uma Notificação só.

**Teste previsto:** Vitest, `src/app/utils/activity.test.ts` ("notificationTitle" e
"isNotificationRead" com Tarefa) e `src/app/utils/notification-destination.test.ts`; e2e da API,
`test/task-notifications.e2e-spec.ts`, "duas conclusões simultâneas notificam uma vez".

### CA9

**Marca:** documento

**Cenário:** Quem revisa abre o LLD e encontra `task_notifications`, a fonte nova da consulta de
Atividade, as rotas e o `task_count`.

## Contrato

### task_notifications · chat · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | não | — | UUID v7: comparável à marca de Atividade |
| `created_at`, `updated_at` | `timestamptz` | não | `now()` | — |
| `task_id` | `uuid` | não | — | — |
| `recipient_id` | `uuid` | não | — | — |
| `kind` | `text` | não | — | `received`, `completed` ou `reopened` |
| `read_at` | `timestamptz` | sim | — | — |

- Chave primária `id`. Chaves estrangeiras: `task_id` → `tasks` (CASCADE), `recipient_id` →
  `people` (sem ação).
- Índice `task_notifications_recipient_idx` em `(recipient_id, id)`.
- `CHECK` `task_notifications_kind_check`, declarado na entidade e conferido à mão na migração.

### GET /v1/activity · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Item da resposta | `{ kind: "mention" \| "direct", message, conversation }` | mais `{ kind: "task", notification: { id, kind: "received" \| "completed" \| "reopened", read }, task, actor: { id, name, username } }`, só em `kind=all` |
| `before` | o id da Mensagem mais antiga recebida | o id do item mais antigo recebido: Mensagem ou Notificação de Tarefa |

### GET /v1/activity/unread e PUT /v1/activity/read · alteradas

| Item | Antes | Depois |
| --- | --- | --- |
| Resposta | `activity_read_message_id`, `total_count`, `mention_count`, `direct_count` | mais `task_count`; `total_count` soma os três, com o teto |
| Corpo do `PUT` | `{ message_id }` | `{ message_id }` ou `{ task_notification_id }`, exatamente um |
| Erros do `PUT` | 400, 401, 404 `message_not_found` | os mesmos; o id de uma Notificação de outra Pessoa também é 404 `message_not_found` |

### PUT /v1/activity/task-notifications/:id/read · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Sessão |
| Resposta de sucesso | 204, também quando já estava lida |
| Erros | 401 `unauthenticated`; 404 `not_found` (id malformado, inexistente ou de outra Pessoa) |

### task.created e task.updated · alterados

| Item | Antes | Depois |
| --- | --- | --- |
| Carga | `{ task }` | `{ task, notification: { id, kind } \| null }`, montada para cada Pessoa: a Notificação dela, ou nula |

### activity.unread · alterado

Ganha `task_count`.

### Rotas do BFF

- `PUT /api/activity/read`: o corpo aceita `{ messageId }` ou `{ taskNotificationId }`.
- `PUT /api/activity/task-notifications/:id/read` · nova: repassa à rota da API; 204, 401, 404 e
  502.

## Verificação do contrato

- `task_notifications`: as linhas, CA1; a unicidade de uma Notificação por mudança vem da trava da
  Tarefa, CA8 ("duas conclusões simultâneas").
- `GET /v1/activity` com Tarefa: CA2. `unread` com `task_count`: CA2.
- `PUT /v1/activity/read` com `task_notification_id`: 200 e 404, CA3.
- `PUT /v1/activity/task-notifications/:id/read`: 204 e 404, CA3; 401 pelo `AuthGuard` do
  controller, como as outras rotas de Atividade.
- Eventos com `notification` e `activity.unread` com `task_count`: CA4.
- Rotas do BFF: CA5, pela tela.

## Decisões

- A Notificação de Tarefa é lida pela consulta de Atividade como mais uma fonte (ADR 0029): o
  `NotificationFinder` lê `task_notifications` como já lê Mensagens e Menções, sem depender do
  módulo de Tarefas; o `ActivityService` monta o item com o `TasksService`.
- O `actor` do item e do Alerta sai da Tarefa: quem delegou na `received`, o Responsável nas outras.
  O cliente o calcula do mesmo jeito a partir do evento.
- Marcar uma Notificação de Tarefa como lida publica `activity.unread` para a Pessoa, como marcar
  tudo como lido.
- No cliente, o item de Tarefa entra na lista de Atividade pelo evento de Tarefa com `notification`;
  as funções de cache das Mensagens passam a ignorar os itens de Tarefa.
- O Alerta não tem evento próprio: a central de alertas decide a partir de `task.created` e
  `task.updated` com `notification`, com as regras de destino da F08, e trata a aba Tarefas aberta
  e em foco como a Conversa aberta.

## Arquivos e interfaces

- API do chat: `src/tasks/task-notification.entity.ts`, `src/tasks/tasks.service.ts` (grava a
  `received`), `src/tasks/task-status.service.ts` (grava `completed` e `reopened` e publica),
  `src/bot/bot-actions.service.ts` (publica com a Notificação), `src/notifications/notification-finder.ts`
  (fonte `task`, `taskCount`, `advanceMarkToTaskNotification`, `markTaskNotificationRead`),
  `src/activity/` (serviço, resposta, DTO e rota nova), `src/realtime/realtime.publisher.ts`,
  `packages/chat-events/index.d.ts`, `migrations/1794490000000-AddTaskNotifications.ts`; testes
  `test/task-notifications.e2e-spec.ts` e `test/realtime-tasks.e2e-spec.ts`.
- Web: `src/app/services/chat-api.ts` (`ActivityItem` com Tarefa, `taskCount`,
  `markTaskNotificationRead`), `src/app/utils/activity.ts` (título, leitura, aba Tarefas com
  `taskCount`), `src/app/utils/activity-cache.ts`, `src/app/utils/activity-unread.ts`,
  `src/app/utils/notification-destination.ts`, `src/app/components/notification/` (lista, item de
  Tarefa, marcar tudo, central de alertas), rotas do BFF; Playwright
  `e2e/atividade/notificacao-de-tarefa.spec.ts`.

## Testes existentes que mudam

- Os testes da Atividade e do `activity.unread` que comparam o corpo inteiro passam a ver
  `task_count` 0.

## Mudança de dados

Nenhuma.

## Documentos atualizados

- `docs/lld.md`, "Concorrência e idempotência" ("Notificações"): a fonte de Tarefa, com a leitura
  gravada (ADR 0029).
- `docs/lld.md`, "Dados": `task_notifications` `planejada`.
- `docs/lld.md`, "Interfaces": as rotas de Atividade alteradas e a nova, `planejadas`.
