# Plano da F11-T01: A Mensagem pode ter um bot como autor

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas, seção "Conversa") e encontra
"Conversa / Mensagem / Mensagem do Agente" e "Conversa / Mensagem / Mensagem do Agente (escuro)":
o pedido de uma Pessoa, a Mensagem do Agente na forma completa (MessageItem `Layout=full` com o
AgentAvatar, o nome, o AgentTag e o texto) e, logo abaixo, a segunda Mensagem do Agente na forma
compacta (`Layout=compact`), nos temas claro e escuro.

### CA2

**Marca:** teste HTTP

**Cenário:** Dado um banco com as migrações até a anterior a esta e uma Mensagem gravada com
`author_id`, quando a migração roda, então a Mensagem tem a mesma Pessoa em `author_person_id` e
`author_bot_id` nulo. Dado o banco migrado, quando se grava uma Mensagem sem autor ou com os dois,
então o banco recusa pelo `messages_author_check`; com só a Pessoa ou só o bot, aceita.

**Teste previsto:** e2e da API, `test/database.e2e-spec.ts`, "a migração do autor preserva a
Pessoa das Mensagens existentes" (num banco próprio, criado e apagado pelo teste) e "o CHECK do
autor de messages exige exatamente um autor".

### CA3

**Marca:** teste HTTP

**Cenário:** Dado um Canal com uma Mensagem de Pessoa e uma de bot, quando um Membro lê o
histórico, então a de Pessoa traz `author: { kind: "person", id, name, username }` e a de bot
`author: { kind: "bot", id, name, username }`; o envio responde e publica o `message.created` com o
autor `person` e o `username`; a Citação de uma Mensagem de bot traz o autor `bot`.

**Teste previsto:** e2e da API, `test/messages.e2e-spec.ts` ("o histórico traz o autor bot da
Mensagem de bot" e os casos de envio que já existem, com o autor novo),
`test/messages-quote.e2e-spec.ts` ("cita uma Mensagem de bot") e
`test/realtime-messages.e2e-spec.ts` (o autor do evento).

### CA4

**Marca:** teste HTTP

**Cenário:** Dado um Canal e uma Conversa direta com uma Mensagem de bot gravada na preparação,
quando os Membros leem as Conversas, então ela conta como Não lida para todos; quando leem a
Atividade, então ela não aparece nem conta, nem na Conversa direta; quando um Membro edita ou apaga
a Mensagem de bot, então recebe 403 `message_not_owned`.

**Teste previsto:** e2e da API, `test/unread.e2e-spec.ts` ("a Mensagem de bot conta como Não lida
para os Membros"), `test/activity.e2e-spec.ts` ("a Mensagem de bot não vira Notificação, nem na
Conversa direta"), `test/messages-edit.e2e-spec.ts` e `test/messages-delete.e2e-spec.ts`
("responde 403 ao editar/apagar a Mensagem de um bot").

### CA5

**Marca:** teste no Playwright

**Cenário:** Dado um Canal com uma Mensagem de bot, quando a Pessoa abre a Conversa, então a
Mensagem mostra o AgentAvatar, o nome do Agente e o AgentTag "AGENTE", sem o UserStatus; clicar no
nome ou no avatar abre o diálogo "Agentes"; Enter no nome também abre, e o foco volta ao nome ao
fechar.

**Teste previsto:** Playwright, `e2e/agentes/mensagem-do-agente.spec.ts`.

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado duas Pessoas num Canal, quando a Mensagem de bot está no histórico, então as duas
a veem como Mensagem do Agente; quando o `message.created` de uma Mensagem de bot chega à aba da
outra Pessoa, então ela aparece sem recarregar, com o AgentTag. O axe na Conversa com a Mensagem do
Agente, completa e compacta, nos temas claro e escuro, não acha violações.

**Teste previsto:** Playwright, `e2e/agentes/mensagem-do-agente.spec.ts` e
`e2e/acessibilidade/mensagem-do-agente-sem-violacoes.spec.ts`.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra a Mensagem do Agente,
completa e compacta, nos dois temas, ao lado do frame do Figma.

## Contrato

### messages · chat · alterada

| Antes | Depois |
| --- | --- |
| `author_id uuid NOT NULL`, FK para `people` | `author_person_id uuid NULL`, FK para `people` (`NO ACTION`), a mesma coluna renomeada |
| — | `author_bot_id uuid NULL`, FK para `bots` (`NO ACTION`) |
| `messages_author_client_key` única em `(author_id, client_id)` | a mesma, em `(author_person_id, client_id)`: o bot não usa o `client_id` para não duplicar (a ação de bot, na 03, tem unicidade própria) |
| — | `messages_author_check`: `num_nonnulls(author_person_id, author_bot_id) = 1`. Escrito à mão na migração `…-AddMessageBotAuthor` |

A volta da migração recusa enquanto houver Mensagem de bot, porque `author_id` não aceita nulo.

### Autor da Mensagem · alterado

Vale para a resposta REST da Mensagem (`GET` e `POST /v1/conversations/:id/messages`,
`PATCH …/:id`, os itens de `GET /v1/activity`), para a Citação (`quote.author`) e para os eventos
`message.created` e `message.updated` (`MessageAuthorPayload` do `packages/chat-events`).

| Antes | Depois |
| --- | --- |
| `author: { id, name }` | `author: { kind: "person" \| "bot", id, name, username }` |

## Verificação do contrato

- `author_person_id` preservado pela migração: CA2.
- `messages_author_check`: CA2.
- FK de `author_bot_id` para `bots`: CA4 (a Mensagem de bot gravada na preparação aponta um bot
  real); a regra de exclusão não tem caso, porque nenhum caminho apaga bot.
- O autor `{ kind, id, name, username }` no histórico, no envio, na Citação e no evento: CA3.
- Editar e apagar a Mensagem de bot, 403 `message_not_owned`: CA4.

## Decisões

- **O autor na resposta.** `MessageAuthor` do service vira `{ kind, id, name, username }`, montado
  por `withDetails` (a função única), que busca as Pessoas e os bots dos ids da página numa consulta
  para cada. A Citação usa o mesmo formato, porque uma Mensagem de bot pode ser citada.
- **Quem envia e edita.** `sendMessage` e `editMessage` continuam recebendo a Pessoa da Sessão
  (`{ id, name, username }`) e montam o autor `person`: a gravação como bot é da 03.
- **Não lidas.** A comparação vira `author_person_id IS DISTINCT FROM member.person_id`, para a
  Mensagem de bot (Pessoa nula) contar (spec, "Autor da Mensagem").
- **Notificações.** `author_person_id <> person.id` já deixa de fora a Mensagem de bot, porque a
  comparação com nulo não é verdadeira: fica assim, com um comentário dizendo que é de propósito.
- **Editar e apagar.** `lockOwnMessage` compara `authorPersonId` com a Pessoa: a de bot cai no
  `message_not_owned` sem código novo.
- **Teste da migração num banco próprio.** O teste cria um banco com o `TEST_DATABASE_ADMIN_URL`,
  roda as migrações, desfaz a última, grava uma Mensagem no formato antigo, roda de novo e confere;
  depois apaga o banco. Fazer isso no `chat_test` travaria a tabela `messages` dos testes em
  paralelo.
- **Mensagem de bot na preparação.** Na API, o atalho `conversationRoutes.insertBotMessage` grava
  direto no banco, com um bot criado pelo `BotsService`; na web, `insertBot` e `insertBotMessage`
  em `e2e/support/database.ts`, com um bot de `@usuário` aleatório, para não depender do
  `assistente` nem do estado global dos Agentes.
- **Tempo real no Playwright.** Nesta tarefa nada na API publica Mensagem de bot (a publicação é da
  `reply`, na 03). O teste prova o cliente: lê a Mensagem de bot pela API do chat, com a Sessão da
  Pessoa, e a injeta como `message.created` no WebSocket da outra aba pelo `routeWebSocket`, que já
  é usado nos testes do tempo real. A chegada pelo servidor fica provada na 03 (CA7 dela).
- **MessageItem de bot.** A forma completa troca o `PersonAvatar` pelo `AgentAvatar` `md` e o
  nome-perfil por um botão com o nome que abre o diálogo "Agentes" (`useOpenAgentsDialog`, como o
  `AgentMentionChip`), seguido do `AgentTag` e da hora, sem `UserStatus`. O avatar abre o diálogo ao
  clicar e fica fora da ordem do teclado, como o avatar da Pessoa, porque o nome ao lado faz o
  mesmo: "Enter" do CA5 é no nome. A forma compacta leva o nome e "Agente" só para o leitor de tela.
- **AgentTag.** Componente novo, `components/agent/agent-tag.tsx`, com os valores do Figma (12:282):
  `h-4 px-1 rounded-control bg-surface-inset text-caption font-bold text-fg-muted`, texto "AGENTE".
- **Cliente.** `MessageAuthor` da web ganha `kind` e `username`; `notificationKindFor` devolve nulo
  para autor bot, para o Alerta e a notificação do navegador seguirem a API; `messageFromEvent`
  assume `person` e `username` vazio num evento guardado antes da mudança, como já faz com os
  campos da F06.

## Arquivos e interfaces

- `packages/chat-events/index.d.ts`: `MessageAuthorPayload` com `kind` e `username`.
- `apps/chat-api/migrations/<instante>-AddMessageBotAuthor.ts`: nova, escrita à mão.
- `apps/chat-api/src/messages/message.entity.ts`: `authorPersonId`, `authorBotId` e o `@Check`.
- `apps/chat-api/src/messages/messages.service.ts`, `message.response.ts`, `messages.controller.ts`
  e `messages.module.ts`: o autor novo; `BotsModule` importado.
- `apps/chat-api/src/bots/bots.service.ts`: `findByIds(ids)`.
- `apps/chat-api/src/conversations/unread-counter.ts` e
  `src/notifications/notification-finder.ts`: a coluna nova.
- `apps/chat-api/test/support/conversation-routes.ts`: `insertMessages` com `author_person_id`,
  `insertBotMessage` e a criação do bot.
- `apps/web/src/app/services/chat-api.ts`, `utils/message-event.ts`, `utils/activity-cache.ts`,
  `hooks/use-pending-messages.ts`, `(app)/conversas/[id]/page.tsx`: o autor novo.
- `apps/web/src/app/components/agent/agent-tag.tsx`: novo.
- `apps/web/src/app/components/message/message-item.tsx`: as linhas de bot.
- `apps/web/e2e/support/database.ts`: `insertBot`, `insertBotMessage` e `author_person_id`.
- `apps/web/e2e/agentes/mensagem-do-agente.spec.ts`,
  `apps/web/e2e/acessibilidade/mensagem-do-agente-sem-violacoes.spec.ts` e
  `apps/web/e2e/plano-de-testes-f11.md`: novos.

## Testes existentes que mudam

- `test/messages.e2e-spec.ts`, `test/messages-quote.e2e-spec.ts`: o autor esperado ganha `kind` e
  `username`; a coluna `author_id` vira `author_person_id`.
- `test/database.e2e-spec.ts` e `src/conversations/conversations.int-spec.ts`: as inserções
  diretas usam `author_person_id`.
- Testes de unidade da web com Mensagens de exemplo (`message-event`, `activity-cache`,
  `pending-messages` e outros): o autor de exemplo ganha `kind` e `username`.

## Mudança de dados

Nenhuma além da migração: as Mensagens existentes passam a ter a Pessoa em `author_person_id`.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra o autor Pessoa ou bot como `planejado` (spec da F11,
"Autor da Mensagem"); ele passa a `existe` no fim da tarefa.
