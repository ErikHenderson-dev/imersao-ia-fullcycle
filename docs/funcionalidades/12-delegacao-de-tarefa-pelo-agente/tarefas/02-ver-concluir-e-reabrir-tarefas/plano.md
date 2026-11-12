# Plano da F12-T02: Ver, concluir e reabrir Tarefas em Atividade → Tarefas

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado o Bruno com duas Tarefas recebidas (uma aberta, uma concluída) e a Ana com uma
delegada a si mesma, quando o Bruno lista `role=assigned`, então recebe as abertas primeiro e,
dentro do estado, as mais novas primeiro, e com `limit=1` o `next_cursor` traz a seguinte; quando a
Ana lista `role=assigned` e `role=delegated`, a Tarefa a si mesma aparece nas duas. Quando o
Responsável ou quem delegou pede `GET /v1/tasks/:id`, recebe a Tarefa; um terceiro recebe 404
`task_not_found`. Sem Sessão, 401; com `role` ou `cursor` inválido, 400.

**Teste previsto:** e2e da API, `test/tasks.e2e-spec.ts`, "lista as abertas primeiro e pagina pelo
cursor", "a Tarefa a si mesmo aparece nas duas listas", "devolve a Tarefa ao Responsável e a quem
delegou", "responde 404 task_not_found a um terceiro" e "valida role e cursor".

### CA2

**Marca:** teste HTTP

**Cenário:** Dado uma Tarefa aberta do Bruno, delegada pela Ana, quando o Bruno a conclui, então
recebe 200 com `status` `done` e `completed_at`; ao reabrir, `open` e `completed_at` nulo. Concluir
uma já concluída, ou reabrir uma aberta, responde 200 sem mudar `updated_at`. A Ana recebe 403
`task_not_assignee`; um terceiro, 404 `task_not_found`.

**Teste previsto:** e2e da API, `test/tasks.e2e-spec.ts`, "o Responsável conclui e reabre",
"repetir não muda nada", "responde 403 task_not_assignee a quem delegou" e "responde 404
task_not_found a um terceiro ao concluir".

### CA3

**Marca:** teste HTTP

**Cenário:** Com o servidor real, dado o Bruno e a Ana conectados, quando a ação `task` cria a
Tarefa, então `task.created` chega aos dois com a Tarefa; quando o Bruno a conclui, `task.updated`
chega aos dois; o concluir repetido não publica. Depois de uma queda, o Bruno recebe os dois
eventos no reenvio da reconexão.

**Teste previsto:** e2e da API, `test/realtime-tasks.e2e-spec.ts`, "task.created e task.updated
chegam ao Responsável e a quem delegou" e "os eventos de Tarefa voltam na reconexão".

### CA4

**Marca:** teste HTTP

**Cenário:** Dado a Mensagem do Pedido apagada pela Ana, quando o Bruno lista as Tarefas, então a
Tarefa vem com `trigger_message.deleted` verdadeiro.

**Teste previsto:** e2e da API, `test/tasks.e2e-spec.ts`, "a Tarefa diz que o Pedido foi apagado".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dado a Ana e o Bruno num Canal e uma Tarefa do Bruno criada pela rota do bot, quando
o Bruno abre Atividade → Tarefas, então vê a Tarefa em Recebidas com "Concluir"; ao concluir, ela
passa a concluída com "Reabrir", e na aba da Ana, em Delegadas, o estado muda sem recarregar. Com a
aba vazia, aparece o estado vazio.

**Teste previsto:** Playwright, `e2e/atividade/tarefas.spec.ts`, "concluir e reabrir chegam a quem
delegou" e "a aba vazia explica como pedir uma Tarefa".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado uma Tarefa do Bruno, quando ele abre `/atividade?aba=tarefas&tarefa=<id>`, então
a Tarefa recebe o foco e o destaque.

**Teste previsto:** Playwright, `e2e/atividade/tarefas.spec.ts`, "o link com a Tarefa a destaca".

### CA7

**Marca:** revisão humana

**Cenário:** Quem revisa abre o Figma e encontra, nos dois temas, a aba Tarefas com os grupos, a
Tarefa aberta e concluída, a com o Pedido apagado, a destacada e o vazio, feitos antes do código.

### CA8

**Marca:** teste de unidade

**Cenário:** Dado as páginas de um grupo, quando chega uma Tarefa nova ou mudada por evento, então
ela entra ou muda de lugar respeitando a ordem (abertas primeiro, mais novas primeiro), e uma
Tarefa de outro grupo não entra. Os testes HTTP e de Playwright de CA1 a CA6 completam o critério,
com o teclado coberto em CA5.

**Teste previsto:** Vitest, `src/app/utils/tasks.test.ts`, "mergeTask" e "taskRole".

### CA9

**Marca:** documento

**Cenário:** Quem revisa abre o LLD e encontra as rotas de Tarefa, os eventos e a aba Tarefas em
`/atividade`, e a regra da repetição sem efeito em "Tarefa".

## Contrato

### GET /v1/tasks · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Sessão (cookie), pelo `AuthGuard` |
| Consulta | `role`: `assigned` ou `delegated`, obrigatório; `cursor`: opcional, o `next_cursor` de uma página anterior; `limit`: inteiro de 1 a 100, padrão 50 |
| Resposta de sucesso | 200 `{ tasks: Task[], next_cursor: string \| null }`, com `Task` no formato da F12-T01 |
| Erros | 400 `validation_failed`; 401 `unauthenticated` |

O cursor é `<status>.<id>` da última Tarefa da página; a próxima página traz as Tarefas depois dela
na ordem (`status` aberta antes de concluída, `id` decrescente).

### GET /v1/tasks/:id · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Sessão |
| Resposta de sucesso | 200 `{ task }` |
| Erros | 401 `unauthenticated`; 404 `task_not_found` (também id malformado e quem não é Responsável nem quem delegou) |

### POST /v1/tasks/:id/complete e POST /v1/tasks/:id/reopen · novas

| Item | Descrição |
| --- | --- |
| Autenticação | Sessão |
| Resposta de sucesso | 200 `{ task }`. A repetição devolve a Tarefa como está, sem publicar |
| Erros | 401 `unauthenticated`; 403 `task_not_assignee`; 404 `task_not_found` |

### task.created e task.updated · servidor → cliente · novos

| Item | Descrição |
| --- | --- |
| Quem recebe | O Responsável e quem delegou (uma vez, quando são a mesma Pessoa), como eventos guardados por Pessoa e reenviados na reconexão |
| Autenticação | A Sessão da conexão |
| Carga | `{ event_id?, task: Task }` |

### Rotas do BFF · novas

`GET /api/tasks?role=&cursor=`, `GET /api/tasks/:id`, `POST /api/tasks/:id/complete` e
`POST /api/tasks/:id/reopen` repassam às rotas da API com o cookie da Sessão e devolvem a Tarefa no
formato da web (camelCase). 400 com parâmetro inválido, 401 sem Sessão, 403 e 404 com os códigos da
API, 502 na falha.

## Verificação do contrato

- `GET /v1/tasks`: 200, ordem e cursor, CA1; 400 e 401, CA1.
- `GET /v1/tasks/:id`: 200 e 404, CA1.
- `complete`/`reopen`: 200, repetição, 403 e 404, CA2; 401 entra no "valida role e cursor"
  como caso de rota protegida, em CA1.
- `task.created`, `task.updated`: CA3.
- Rotas do BFF: CA5 e CA6, pela tela.

## Decisões

- O erro `task_not_found` cobre também quem não é parte da Tarefa, para não revelar que ela
  existe; `task_not_assignee` só para quem delegou, que já a conhece.
- A mudança de estado trava a linha da Tarefa e só publica e grava `updated_at` quando muda.
- O `task.created` sai da ação `task`, depois do commit, com a mesma Tarefa da resposta.
- A aba Tarefas não tem contador nesta tarefa: o `task_count` é da F12-T03. O tipo da aba passa a
  aceitar contador nulo.
- Os dois grupos são duas listas paginadas independentes, com 50 por página, como a lista de
  Atividade, e atualização otimista no botão, desfeita no erro com um aviso.
- O destaque usa a cor de destaque das Notificações não lidas e o foco no item; a Tarefa fora da
  primeira página é buscada pela rota de uma Tarefa e mostrada no topo do grupo dela.

## Arquivos e interfaces

- API do chat: `src/tasks/tasks.controller.ts` (rotas), `tasks.service.ts` (`listFor`,
  `findVisible`, `complete`, `reopen`), `task-not-found.error.ts`, `task-not-assignee.error.ts`,
  `list-tasks.query.ts`, `src/common/errors/error-code.ts` e o filtro; `src/realtime/realtime.publisher.ts`
  (`taskCreated`, `taskUpdated`); `src/bot/bot-actions.service.ts` (publica `task.created`);
  `packages/chat-events/index.d.ts` (eventos e `TaskPayload`); testes `test/tasks.e2e-spec.ts`,
  `test/realtime-tasks.e2e-spec.ts` e o apoio `test/support/task-routes.ts`.
- Web: `src/app/services/chat-api.ts` (`Task`, `listTasks`, `getTask`, `changeTaskStatus`),
  `src/app/api/tasks/...` (rotas do BFF), `src/app/utils/tasks.ts` (`mergeTask`, `taskRole`),
  `src/app/utils/activity.ts` (aba `tasks`), `src/app/components/notification/activity-tabs.tsx`,
  `src/app/components/tasks/` (`TaskBoard`, `TaskGroup`, `TaskItem`, `TasksEmpty`),
  `src/app/(app)/atividade/page.tsx`, `src/app/components/realtime/realtime-provider.tsx`
  (`onTaskCreated`, `onTaskUpdated`); Playwright `e2e/atividade/tarefas.spec.ts` e o apoio
  `e2e/support/bot.ts` (`botTask`).

## Testes existentes que mudam

- `src/app/utils/activity.test.ts`: `?aba=tarefas` deixa de cair em Todas e passa a ser a aba
  Tarefas.

## Mudança de dados

Nenhuma.

## Documentos atualizados

- `docs/lld.md`, "Interfaces": as rotas de Tarefa e do BFF, `planejadas`.
- `docs/lld.md`, "Estados e regras" (6.1): a repetição sem efeito, que fecha a questão em aberto,
  e o `task_not_found` para quem não é parte.
- `docs/lld.md`, "Cliente": a aba Tarefas em `/atividade`, `planejada`.
- `docs/lld.md`, "Questões em aberto": sai a da Tarefa repetida.
