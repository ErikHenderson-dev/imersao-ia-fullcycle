# Plano da F05-T04: Abrir uma Conversa direta pelo Perfil

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas) e encontra "Conversa / Lista /
Início da conversa direta" com "Este é o começo da sua conversa direta com Regina Fonseca.", um
frame novo do começo da Conversa consigo mesma e um frame novo do painel com a falha ao abrir a
Conversa direta, feitos antes do código das telas.

### CA2

**Marca:** teste HTTP

**Cenário:** Dado o banco de testes, quando o teste grava uma Conversa `direct` com nome ou Tópico,
sem as duas Pessoas, com `low > high`, ou uma segunda Conversa direta do mesmo par, então o banco
recusa; um Canal com as colunas do par também é recusado.

**Teste previsto:** e2e da API, `test/database.e2e-spec.ts`, "conversations recusa %s"
(`it.each`).

### CA3

**Marca:** teste HTTP

**Cenário:** Dada uma Pessoa com Sessão, quando ela pede `POST /v1/conversations` com
`kind: "direct"` e o id de outra Pessoa, então recebe 201 com a Conversa, e só ela é Membro; pedir
de novo devolve 200 com a mesma Conversa; a outra Pessoa abrindo antes da primeira Mensagem recebe
200 com a mesma Conversa e vira Membro; as duas ao mesmo tempo dão numa Conversa só; consigo mesma,
201 com um Membro; Pessoa inexistente, 404 `person_not_found`; `name` ou `client_id` junto,
400; e um Canal criado com a entrada da F04 continua funcionando.

**Teste previsto:** e2e da API, `test/conversations-direct.e2e-spec.ts`, "responde 201 e grava só
quem abriu", "responde 200 com a mesma Conversa ao abrir de novo", "a outra Pessoa abre a mesma
Conversa e vira Membro", "as duas pontas ao mesmo tempo dão numa Conversa só", "abre a Conversa
consigo mesma", "responde 404 person_not_found para quem não é Pessoa" e "responde 400 para %s".

### CA4

**Marca:** teste HTTP

**Cenário:** Dadas Conversas diretas e Canais, quando a Pessoa lê a lista e cada Conversa, então
toda Conversa traz `counterpart` (a outra Pessoa, a própria na Conversa consigo mesma, nulo no
Canal) e o `kind` `direct`; a lista traz os Canais primeiro, em ordem alfabética, e depois as
Conversas diretas, pela ordem do nome do `counterpart`.

**Teste previsto:** e2e da API, `test/conversations-direct.e2e-spec.ts`, "a lista traz os Canais e
depois as Conversas diretas pelo nome da outra Pessoa" e "a Conversa traz o counterpart de quem
pede"; Vitest, `src/app/utils/conversation-list.test.ts`, "ordena os Canais antes das Conversas
diretas" e "insere a Conversa direta pela ordem do counterpart".

### CA5

**Marca:** teste HTTP

**Cenário:** Quando a Pessoa abre uma Conversa direta e vira Membro agora, as outras abas dela
recebem `conversation.member_added` com `person_ids` dela, e a outra Pessoa, que não é Membro, não
recebe nada; abrir de novo não publica; adicionar Membros a uma Conversa direta responde 409
`members_not_editable`; quem não é Membro recebe 404 na Conversa, no histórico e nos Membros.

**Teste previsto:** e2e da API, `test/realtime-conversations.e2e-spec.ts`, "a abertura da Conversa
direta chega às abas de quem abriu e não à outra Pessoa" e "abrir de novo não publica";
`test/conversations-direct.e2e-spec.ts`, "responde 409 ao adicionar Membros" e "quem não é Membro
recebe 404".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado o Perfil de outra Pessoa, quando a pessoa clica em "Mensagem", então o botão
fica em "Abrindo" e a Conversa direta abre, com o foco na caixa de mensagem; se a abertura falhar,
o erro aparece no painel e "Mensagem" tenta de novo.

**Teste previsto:** Playwright, `e2e/conversa-direta/abrir-pelo-perfil.spec.ts`, "abre a Conversa
direta pelo Perfil" e "a falha ao abrir aparece no painel e tenta de novo" (a Server Action
respondida com falha pelo `routeServerAction`).

### CA7

**Marca:** teste no Playwright

**Cenário:** Com a Conversa direta aberta, a barra lateral mostra "Mensagens diretas" abaixo de
"Canais", com o avatar e o nome da outra Pessoa, e "você" na Conversa consigo mesma; o cabeçalho
mostra o avatar e o nome, que abrem o Perfil, sem Tópico nem Membros; o começo da conversa e a
caixa de mensagem seguem o texto da spec; reabrir pelo Perfil cai na mesma Conversa; a Conversa
aparece em outra aba da mesma Pessoa sem recarregar.

**Teste previsto:** Playwright, `e2e/conversa-direta/abrir-pelo-perfil.spec.ts`, "reabrir cai na
mesma Conversa", "a Conversa consigo mesma aparece com você", "o cabeçalho abre o Perfil" e "a
Conversa aparece em outra aba sem recarregar".

### CA8

**Marca:** teste HTTP

**Cenário:** Os testes do CA2 ao CA5.

**Teste previsto:** os do CA2 ao CA5.

### CA9

**Marca:** teste no Playwright

**Cenário:** Os cenários do CA6 e do CA7 rodam pelo teclado, e o axe não encontra violações na
Conversa direta aberta.

**Teste previsto:** Playwright, `e2e/acessibilidade/conversa-direta-sem-violacoes.spec.ts`.

### CA10

**Marca:** revisão humana

**Cenário:** Quem revisa abre `validacao-visual.md` desta pasta e encontra a Conversa direta, o
começo dela, a Conversa consigo mesma e a barra lateral, nos dois temas, ao lado do
`get_screenshot` dos frames.

## Contrato

### conversations · chat · alterada

| Coluna | Tipo | Nulo | Observação |
| --- | --- | --- | --- |
| `direct_person_low_id` | uuid | sim | Referência a `people`, `ON DELETE CASCADE` |
| `direct_person_high_id` | uuid | sim | Referência a `people`, `ON DELETE CASCADE` |

- `conversations_kind_check`: `kind IN ('public_channel', 'private_channel', 'direct')`.
- `conversations_direct_check`, novo: com `kind = 'direct'`, `name` e `topic` nulos e as duas
  colunas preenchidas, com `low <= high`; nos Canais, as duas nulas.
- Única parcial nova: `conversations_direct_pair_key` em (`direct_person_low_id`,
  `direct_person_high_id`) onde `kind = 'direct'`.
- Os `CHECK` e a única parcial ficam na entidade e numa migração escrita à mão.

### POST /v1/conversations · alterada

| Item | Descrição |
| --- | --- |
| Corpo, Conversa direta | `kind: "direct"`, `person_id` (uuid), e nada de `name`, `topic` ou `client_id` |
| Corpo, Canal | O da F04, sem `person_id` |
| Resposta de sucesso | 201 com `conversation` quando a Conversa direta foi criada agora; 200 quando já existia. Canal: como na F04 |
| Erros | 404 `person_not_found`; 400 `validation_failed`; 409 `channel_name_taken` (Canal); 401 |

### Conversa nas respostas e no evento · alterada

`ConversationPayload` (REST e `conversation.member_added`): o `kind` aceita `direct`, e entra
`counterpart`: `{ id, name, username }` ou `null`, sempre do ponto de vista de quem recebe.

### conversation.member_added · servidor → cliente · alterado

| Item | Descrição |
| --- | --- |
| Quem recebe | Também na abertura de uma Conversa direta: os Membros dela depois da gravação, quando quem abriu virou Membro agora |
| Carga | A da F04, com a Conversa montada para cada destinatário (o `counterpart` dele) |

## Verificação do contrato

- `CHECK`, única parcial e chaves de `conversations`: CA2.
- `POST /v1/conversations` 201, 200, 404, 400, e o Canal da F04: CA3.
- `counterpart`, `kind` e a ordem da lista: CA4.
- `conversation.member_added` na abertura, e o 409 da adição: CA5.

## Decisões

- **Par na entidade:** `directPersonLowId` e `directPersonHighId`, com o `@Check` e o `@Index`
  único parcial na entidade; a migração escreve os `CHECK` à mão, como a `AddPrivateChannel`.
- **Abrir:** `ConversationsService.openDirectConversation(openerId, personId)`, `@Transactional`:
  confere a Pessoa (`PersonNotFoundError(null)`), grava a Conversa com
  `INSERT … ON CONFLICT (low, high) WHERE kind = 'direct' DO NOTHING RETURNING id`, lê a do par
  quando não gravou, e grava a participação de quem abriu pelo `insertMembers`. Devolve a Conversa
  com os Membros, se foi criada e se quem abriu entrou agora. O `MembershipsService` orquestra e
  publica o `member_added` só quando quem abriu entrou agora.
- **Rota:** o `CreateConversationDto` aceita `kind: "direct"` e `person_id`, com `@ValidateIf`
  separando as duas entradas; o controller responde 201 ou 200 pelo `@Res({ passthrough: true })`.
- **Outra Pessoa:** a `ConversationSummary` ganha `directPeople` (as duas Pessoas, com id, nome e
  `@usuário`), lidas no `withMemberCounts` de uma vez para todas as Conversas diretas. O
  `toConversationResponse(summary, viewerId)` escolhe o `counterpart`. O
  `RealtimePublisher.memberAdded` passa a receber a Conversa como função de quem recebe.
- **Ordem:** `ConversationsService.listSummariesForMember(personId)` ordena os Canais pelo nome e
  depois as Conversas diretas pelo nome do `counterpart`, com o `compareNames`.
- **Web, tipo:** a `Conversation` ganha `counterpart` (`{ id, name, initials, username }` ou
  `null`). `conversationTitle(conversation)` dá `#nome` no Canal e o nome da outra Pessoa na
  Conversa direta, usado nos rótulos do histórico; `composerLabel(conversation, selfId)` dá
  "Mensagem para #nome", "Mensagem para <primeiro nome>" ou "Mensagem para você".
- **Web, lista:** `compareConversations` (Canais antes, cada grupo na sua ordem) substitui a ordem
  só pelo nome no `applyMemberAdded`. A `ChannelList` vira `ConversationList`, que mostra "Canais" e
  "Mensagens diretas" do mesmo cache; a SidebarRow ganha a variante com avatar e "você".
- **Web, abrir:** a Server Action `openDirectConversation(personId)` devolve a Conversa. O botão
  "Mensagem" do painel insere a Conversa na lista (o `applyMemberAdded` com a própria Pessoa), leva
  a `/conversas/<id>` e mostra "Abrindo" enquanto isso; a falha fica abaixo do botão.
- **Web, Conversa:** o cabeçalho e o começo da conversa ganham a variante da Conversa direta; o
  botão de Membros não aparece nela. "Nova conversa" fica para a 06.

## Arquivos e interfaces

- `apps/chat-api/src/conversations/conversation.entity.ts`, `conversations.service.ts`,
  `conversation.response.ts`, `create-conversation.dto.ts`.
- `apps/chat-api/src/memberships/memberships.service.ts` e `memberships.controller.ts`.
- `apps/chat-api/src/realtime/realtime.publisher.ts`.
- `apps/chat-api/migrations/<timestamp>-AddDirectConversation.ts`.
- `packages/chat-events/index.d.ts`.
- `apps/web/src/app/services/chat-api.ts`, `actions/open-direct-conversation.ts`,
  `utils/conversation-event.ts`, `utils/conversation-list.ts`, `utils/conversation-title.ts`.
- `apps/web/src/app/components/workspace-nav/channel-list.tsx` (vira `conversation-list.tsx`),
  `sidebar-row.tsx`, `sidebar.tsx`.
- `apps/web/src/app/components/conversation/conversation-header.tsx`, `conversation-intro.tsx`,
  `message-history.tsx`, `message-composer.tsx`, `history-loading.tsx`, `history-error.tsx`.
- `apps/web/src/app/(app)/conversas/[id]/page.tsx`.
- `apps/web/src/app/components/profile/profile-panel.tsx`: o botão "Mensagem".
- `apps/web/e2e/conversa-direta/*.spec.ts`, `e2e/acessibilidade/conversa-direta-sem-violacoes.spec.ts`
  e `e2e/plano-de-testes-f05.md`.

## Testes existentes que mudam

- `test/realtime-conversations.e2e-spec.ts` e os testes da F04 que comparam a Conversa com
  `toEqual`: a Conversa ganha `counterpart: null`.
- `e2e/perfil/ver-perfil.spec.ts`: "Mensagem" deixa de estar desabilitado.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum. O LLD e a spec já registram a Conversa direta como `planejada`.
