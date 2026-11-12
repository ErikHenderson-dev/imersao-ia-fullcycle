# Plano da F12-T01: Delegar uma Tarefa e ver a confirmação na Conversa

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open` num Canal com a Ana (quem pediu) e o Bruno como Membros, quando
o bot chama a ação `task` para `bruno`, então o banco tem uma linha em `tasks` com o
`request_id`, a Conversa e a Mensagem do Pedido, o Bruno como Responsável, a Ana como quem
delegou, o título enviado e `status` `open`, sem `completed_at`.

**Teste previsto:** e2e da API, `test/bot-task.e2e-spec.ts`, "grava a Tarefa aberta com o
Responsável e quem delegou".

### CA2

**Marca:** teste HTTP

**Cenário:** Dado o mesmo Pedido, quando o bot chama a ação `task`, então recebe 201 com `task`
(no formato da spec, seção "Concluir, reabrir e listar") e `message`, a confirmação "Tarefa
delegada a Bruno Lima: revisar o contrato até sexta" com autor `bot` e sem Menções; o banco tem a
ação `task` em `bot_actions` apontando para essa Mensagem; e, com o servidor real, ela chega como
`message.created` ao socket de um Membro, seguida do fim do "digitando".

**Teste previsto:** e2e da API, `test/bot-task.e2e-spec.ts`, "responde 201 com a Tarefa e a
confirmação do bot", e `test/realtime-bot.e2e-spec.ts`, "a confirmação da Tarefa chega como
message.created aos Membros".

### CA3

**Marca:** teste HTTP

**Cenário:** Dado uma ação `task` já gravada, quando o bot a chama de novo, com outro título ou
outro Responsável, então recebe 201 com a mesma Tarefa e a mesma confirmação, e o banco continua
com uma Tarefa e uma Mensagem de bot. Sem credencial, 401 `invalid_bot_token`; com id
desconhecido, 404 `request_not_found`; com o Pedido vencido, 410 `request_expired`; com o Pedido
`failed`, 409 `request_closed`.

**Teste previsto:** e2e da API, `test/bot-task.e2e-spec.ts`, "repetir devolve a mesma Tarefa" e
"recusa como as outras ações do bot" (parametrizado pelos quatro casos).

### CA4

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open`, quando o bot pede a Tarefa para uma Pessoa que não é Membro da
Conversa ou para um `@usuário` que não existe, então recebe 422 `assignee_not_member`; para o
`@usuário` de um bot, 422 `assignee_is_bot`; com título vazio, só de espaços ou acima de 120
caracteres, 400 `validation_failed`. Em nenhum caso há Tarefa nem Mensagem gravada. Para a própria
Ana, quem pediu, a Tarefa é criada.

**Teste previsto:** e2e da API, `test/bot-task.e2e-spec.ts`, "responde 422 assignee_not_member"
(parametrizado: não Membro e inexistente), "responde 422 assignee_is_bot", "responde 400 com o
título inválido" (parametrizado) e "delega a quem pediu".

### CA5

**Marca:** teste de integração

**Cenário:** Dado o app real, o modelo real e a API do chat falsa, quando chega o Pedido "@assistente
me lembra de revisar o contrato" da Ana (`ana`), então a API falsa recebe a ação `task` com
`assignee_username` `ana` e um título que fala em revisar o contrato.

**Teste previsto:** integração, `tests/integration/test_request_task.py`, "me vira quem pediu".

### CA6

**Marca:** teste de integração

**Cenário:** Dado o mesmo ambiente, quando chega o Pedido "@assistente delega pra @bruno revisar o
contrato até sexta", com o Bruno em `mentions`, então a API falsa recebe a ação `task` com
`assignee_username` `bruno` e um título de até 120 caracteres sem `@`, e nenhuma `reply`; o log
de fim registra o desfecho `task`. Quando a API falsa responde à ação 422 `assignee_not_member`,
então o Agente grava uma `reply` (a recusa curta) e nenhuma Tarefa existe.

**Teste previsto:** integração, `tests/integration/test_request_task.py`, "delega ao mencionado sem
gravar reply" e "Responsável recusado vira recusa".

### CA7

**Marca:** revisão humana

**Cenário:** Quem revisa abre as instruções do `assistente` e encontra: o Agente resume e delega;
o Responsável vem só de uma Menção a um Membro ou de "mim", "me" e "eu", que são quem pediu, e um
nome sem `@` não identifica ninguém; o título sai do Pedido, em até 120 caracteres, sem `@usuário`
e sem detalhe acrescentado, com o prazo como texto; e a recusa curta cita as duas capacidades. As
instruções mostram ao modelo o `@usuário` e o nome de quem pediu.

### CA8

**Marca:** teste de integração

**Cenário:** Dado o modelo falhando, quando o Pedido roda, então a `reply` gravada é "Não consegui
atender o seu pedido agora. Tente de novo em instantes.".

**Teste previsto:** integração, `tests/integration/test_request_failures.py`, os casos que já
conferem o `NAO_CONSEGUI`, agora com o texto novo.

### CA9

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` conectado com o bot criado, e a Ana e o Bruno num Canal em dois
contextos do navegador, quando a Ana envia "@assistente delega pra @bruno revisar o contrato", com
o modelo real, então a confirmação "Tarefa delegada a …" aparece como Mensagem do Agente para os
dois sem recarregar, e o banco tem a Tarefa aberta do Bruno. Os testes de CA1 a CA6 e CA8 são os
de ponta a ponta da API e de integração do Serviço de agentes.

**Teste previsto:** Playwright, `e2e/agentes/delegar-tarefa.spec.ts`, "a confirmação da Tarefa
chega às duas Pessoas sem recarregar", com o caso no `e2e/plano-de-testes-f12.md`.

### CA10

**Marca:** documento

**Cenário:** Quem revisa abre o LLD e encontra a ação `task` em "Concorrência e idempotência",
`tasks` em "Dados" e a rota do bot em "Interfaces", marcadas `planejada` no commit de plano e
`existe` no fim da tarefa.

## Contrato

### POST /v1/bot/requests/:id/task · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Credencial de bot, `Authorization: Bearer <CHAT_BOT_TOKEN>`, pelo guard do controller `/v1/bot` |
| Parâmetros de caminho | `id`: o identificador de pedido (UUID); malformado responde como desconhecido |
| Corpo da requisição | `assignee_username`: string obrigatória, não vazia, sem `@` na frente e sem caractere nulo; `title`: string obrigatória, pontas aparadas, de 1 a 120 caracteres (pontos de código), sem caractere nulo |
| Resposta de sucesso | 201 `{ task, message }`. `task`: `{ id, title, status: "open" \| "done", created_at, completed_at: string \| null, assignee, delegator, conversation: { id, name: string \| null, kind }, trigger_message: { id, deleted: boolean } }`, com `assignee` e `delegator` `{ id, name, username }`. `message`: a confirmação no formato do histórico, com `author.kind` `bot`. A repetição devolve 201 com a Tarefa e a confirmação já gravadas, sem gravar nem publicar |
| Erros | 400 `validation_failed`; 401 `invalid_bot_token`; 404 `request_not_found`; 409 `request_closed`; 410 `request_expired`; 422 `assignee_not_member` e `assignee_is_bot` |

A ordem das recusas é a das outras ações do bot (credencial, corpo, Pedido inexistente, encerrado,
vencido) e, por último, o Responsável. Na repetição, o Responsável não é conferido de novo: a ação
já gravada é devolvida.

### tasks · chat · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | não | — | UUID v7, gerado na aplicação |
| `created_at`, `updated_at` | `timestamptz` | não | `now()` | — |
| `request_id` | `uuid` | não | — | o Pedido que criou a Tarefa |
| `conversation_id` | `uuid` | não | — | a Conversa do Pedido |
| `trigger_message_id` | `uuid` | não | — | a Mensagem do Pedido |
| `assignee_id` | `uuid` | não | — | o Responsável |
| `delegator_id` | `uuid` | não | — | quem delegou |
| `title` | `text` | não | — | — |
| `status` | `text` | não | `'open'` | — |
| `completed_at` | `timestamptz` | sim | — | — |

- Chave primária `id`. Única em `request_id` (`tasks_request_key`).
- Chaves estrangeiras: `request_id` → `agent_requests` (CASCADE), `conversation_id` →
  `conversations` (CASCADE), `trigger_message_id` → `messages` (CASCADE), `assignee_id` e
  `delegator_id` → `people` (sem ação).
- Índices `tasks_assignee_idx` em `(assignee_id, status, id)` e `tasks_delegator_idx` em
  `(delegator_id, status, id)`.
- `CHECK` `tasks_status_check` (`status IN ('open', 'done')`) e `tasks_title_check`
  (`char_length(title) BETWEEN 1 AND 120`), declarados na entidade e conferidos à mão na migração.

### bot_actions · chat · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| `CHECK` `bot_actions_action_type_check` | `action_type IN ('reply', 'question')` | `action_type IN ('reply', 'question', 'task')`, trocado à mão na migração |

## Verificação do contrato

- `POST /v1/bot/requests/:id/task` 201: CA2; repetição: CA3; 401, 404, 409 e 410: CA3; 400 e 422:
  CA4.
- `tasks`: as colunas gravadas, CA1; a unicidade de `request_id` é o que garante uma Tarefa por
  Pedido em CA3. Os dois `CHECK` de `tasks` não são provados por teste: a rota valida o título e o
  service grava só `open`, então nenhum caminho do produto chega a eles; ficam como guarda do
  banco, conferidos na migração.
- `bot_actions` com `task`: CA2.

## Decisões

- A ação `task` grava, nesta tarefa, a Tarefa, a confirmação e a linha de `bot_actions` numa
  transação. A Notificação `received` entra na mesma transação na F12-T03, dona das Notificações
  de Tarefa.
- O Responsável é resolvido numa consulta só, sobre Pessoas e participações da Conversa do Pedido;
  só quando não acha uma Pessoa Membro é que procura um bot com o `@usuário`, para escolher entre
  `assignee_is_bot` e `assignee_not_member`. Assim, o caminho feliz faz uma consulta.
- O código monta a confirmação com o nome atual do Responsável no Perfil, como a spec manda; o
  título vai como veio, já aparado.
- `task.created` não é publicado nesta tarefa: o evento e a lista que o consome são da F12-T02.
- No Serviço de agentes, a ferramenta marca o estado com `tarefa_do_pedido` e usa
  `skip_summarization`, como a pergunta; o fim do Pedido trata a marca como trata a pergunta, com o
  desfecho novo `task` no log.
- O `ChatApiError` ganha o `code` do corpo `problem+json`, para a ferramenta devolver ao modelo o
  motivo da recusa (`assignee_not_member` ou `assignee_is_bot`) sem depender do texto.
- Com outro erro da ação (API fora, Pedido recusado), a ferramenta propaga a exceção, e o fim do
  Pedido grava o "não consegui" ou descarta, como hoje.
- A API do chat falsa dos testes de integração passa a responder à ação `task` com
  `{ task, message }` e aceita, em `failures`, um par `(status, code)` além do status sozinho.

## Arquivos e interfaces

- API do chat:
  - `src/tasks/task.entity.ts`, `tasks.module.ts`, `tasks.service.ts`: entidade `Task` e
    `TasksService.createForRequest(request, assigneeId, title)` e `viewOf(task)`, que monta a
    Tarefa no payload; `task.response.ts`, com `toTaskResponse`.
  - `src/tasks/assignee-not-member.error.ts` e `assignee-is-bot.error.ts`: erros de domínio.
  - `src/common/errors/error-code.ts`: os dois códigos novos, 422.
  - `src/bot/task.dto.ts`, `bot.controller.ts` (rota `task`), `bot-actions.service.ts`
    (`task(requestId, assigneeUsername, title)`), `bot.module.ts` (importa o `TasksModule`).
  - `src/agent-requests/bot-action.entity.ts`: `BotActionType` com `task`, e o CHECK.
  - `src/tasks/tasks.service.ts`: `findByRequest(requestId)`, que a repetição usa: a linha de
    `bot_actions` guarda a Mensagem, e a Tarefa sai de `tasks` pelo `request_id`.
  - `migrations/1794480000000-AddTasks.ts`.
  - `test/bot-task.e2e-spec.ts`, `test/support/bot-routes.ts` (atalho `task`),
    `test/realtime-bot.e2e-spec.ts`.
- Serviço de agentes:
  - `app/agents/assistente/tools.py`: `delegar_tarefa(responsavel, titulo, tool_context)`.
  - `app/agents/assistente/instructions.py`: instruções da delegação, `RECUSA` nova e quem pediu
    no fim das instruções.
  - `app/agents/assistente/agent.py`: a ferramenta na lista.
  - `app/agent_requests/task.py`: a chamada à ação, a marca no estado e a tradução da recusa.
  - `app/agent_requests/context.py`: `TASK_FOR`.
  - `app/agent_requests/execution.py`: `NAO_CONSEGUI` novo e o desfecho `task`.
  - `app/chat_api.py`: `task(request_id, assignee_username, title)` e `ChatApiError.code`.
  - `tests/integration/conftest.py` (API falsa), `tests/integration/test_request_task.py`.
- Web: `e2e/agentes/delegar-tarefa.spec.ts`, `e2e/support/database.ts` (`latestTaskOf`),
  `e2e/plano-de-testes-f12.md`.

## Testes existentes que mudam

- `tests/integration/test_request_failures.py`: o texto do `NAO_CONSEGUI` muda, e os casos o
  importam, então só a expectativa muda junto.
- O caso `fora_tarefa` do evalset deixa de esperar a recusa. Ele é refeito na F12-T06, dona da
  avaliação; até lá, fica reprovando, e a avaliação não roda na Verificação completa.

## Mudança de dados

Nenhuma.

## Documentos atualizados

- `docs/lld.md`, "Concorrência e idempotência" ("Ação de bot"): o tipo `task`, `planejada`.
- `docs/lld.md`, "Dados": Tarefas `planejada` (`tasks`) e as Notificações de Tarefa gravadas (ADR
  0029).
- `docs/lld.md`, "Interfaces": a rota `POST /v1/bot/requests/:id/task`, `planejada`.
- `docs/lld.md`, "Decisões": a ADR 0029 no índice.
