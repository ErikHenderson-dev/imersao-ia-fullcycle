# Plano da F06-T04: Apagar a própria Mensagem

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dada a migração nova, quando ela roda sobre Mensagens que já existem, então todas
continuam válidas no `CHECK` novo (texto preenchido e `deleted_at` nulo); uma linha com `deleted_at`
e texto, ou sem os dois, é recusada pelo banco.

**Teste previsto:** e2e da API, `test/database.e2e-spec.ts`, "o CHECK de messages aceita a Mensagem
viva e a apagada e recusa as misturas".

### CA2

**Marca:** teste HTTP

**Cenário:** Dado o autor de uma Mensagem, quando ele a apaga, então recebe 204, o texto fica nulo e
`deleted_at` é gravado; o histórico não a traz; apagar de novo, 404; outra Pessoa Membro, 403
`message_not_owned`; Mensagem inexistente, de outra Conversa ou quem não é Membro, 404
`message_not_found`; sem Sessão, 401. Editar uma Mensagem apagada responde 404.

**Teste previsto:** e2e da API, `test/messages-delete.e2e-spec.ts`, "apaga e o histórico não a
traz", "apagar de novo responde 404", "responde 403 para a Mensagem de outra Pessoa", "responde 404
para Mensagem inexistente, de outra Conversa ou de quem não é Membro", "responde 401 sem Sessão" e
"editar a Mensagem apagada responde 404".

### CA3

**Marca:** teste HTTP

**Cenário:** Com Membros e uma Pessoa de fora conectados, quando o autor apaga, então os Membros
recebem `message.deleted` com `conversation_id` e `message_id`, e a Pessoa de fora não; o evento
volta na reconexão, depois de um `message.updated` anterior da mesma Mensagem.

**Teste previsto:** e2e da API, `test/realtime-messages.e2e-spec.ts`, "a exclusão emite
message.deleted para os Membros"; `test/realtime-recovery.e2e-spec.ts`, "a edição e a exclusão
feitas durante a queda voltam na reconexão, nessa ordem".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dada uma Mensagem da Pessoa, quando ela escolhe "Mais ações" → "Apagar", então abre o
diálogo "Apagar mensagem?" com o texto, o foco em "Cancelar" e sem fechar pelo clique fora; Esc
fecha. "Apagar" fica em vermelho, separado, e não aparece nas Mensagens de outra Pessoa.

**Teste previsto:** Playwright, `e2e/conversa/apagar-mensagem.spec.ts`, "abre a confirmação com o
foco em Cancelar e cancela" e "a Mensagem de outra Pessoa não tem Apagar".

### CA5

**Marca:** teste no Playwright

**Cenário:** Com a confirmação aberta, "Apagar" mostra "Apagando"; a falha deixa o diálogo com o erro
e "Tentar de novo", e a Mensagem continua; o sucesso tira a Mensagem e fecha o diálogo, com o foco
na Mensagem seguinte ou na caixa de mensagem.

**Teste previsto:** Playwright, `e2e/conversa/apagar-mensagem.spec.ts`, "apaga e o foco vai para a
seguinte" e "mostra a falha e tenta de novo".

### CA6

**Marca:** teste de unidade

**Cenário:** Dado o cache, quando chega `message.deleted`, então a Mensagem sai pelo id; um
`message.updated` que chega depois não a traz de volta; a seguinte do mesmo autor ganha nome e
avatar pelo agrupamento. Uma edição aberta da Mensagem apagada fecha com aviso, e o `not_found` da
edição faz o mesmo.

**Teste previsto:** Vitest, `src/app/utils/message-pages.test.ts`, "removeDeleted tira pelo id" e
"a edição depois da exclusão não traz a Mensagem de volta"; `message-grouping.test.ts` já prova o
agrupamento recalculado; Playwright, `e2e/conversa/apagar-mensagem.spec.ts`, "a edição aberta fecha
quando a Mensagem é apagada em outra aba".

### CA7

**Marca:** teste HTTP

**Cenário:** O dos CA2, CA3 e CA6, e a edição e a exclusão concorrentes da mesma Mensagem terminam
sem erro do banco.

**Teste previsto:** os dos CA2, CA3 e CA6, e `test/messages-delete.e2e-spec.ts`, "editar e apagar ao
mesmo tempo terminam sem erro do banco".

### CA8

**Marca:** teste no Playwright

**Cenário:** Duas Pessoas: uma apaga e a outra vê a Mensagem sumir sem recarregar; o caminho só pelo
teclado; o axe com o diálogo aberto, sem violações.

**Teste previsto:** Playwright, `e2e/tempo-real/exclusao-sem-recarregar.spec.ts`;
`e2e/conversa/apagar-mensagem.spec.ts`, "apaga só pelo teclado";
`e2e/acessibilidade/apagar-sem-violacoes.spec.ts`.

### CA9

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra as capturas de
"Confirmar apagar", "Apagando" e "Erro ao apagar", nos dois temas, ao lado dos frames.

## Contrato

### messages · chat · alterada

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `deleted_at` | timestamptz | sim | — | nova: a hora da exclusão |
| `body` | text | antes não, depois sim | — | alterada: nulo só na Mensagem apagada |

Restrição, escrita à mão na migração: o `CHECK` `messages_body_length_check` dá lugar a
`messages_body_check`: `(deleted_at IS NULL AND char_length(body) BETWEEN 1 AND 4000) OR
(deleted_at IS NOT NULL AND body IS NULL)`.

### DELETE /v1/conversations/:conversationId/messages/:id · nova

| Item | O que descreve |
| --- | --- |
| Autenticação | Cookie de Sessão (guard da F01) |
| Parâmetros de caminho | `conversationId` e `id`, texto; malformados respondem 404 |
| Resposta de sucesso | 204, sem corpo |
| Erros | 401 `unauthenticated`; 403 `message_not_owned`; 404 `message_not_found` |

### PATCH /v1/conversations/:conversationId/messages/:id · alterada

Antes: a Mensagem apagada não existia. Depois: editar a Mensagem apagada responde 404
`message_not_found`.

### GET /v1/conversations/:conversationId/messages · alterada

Antes: todas as Mensagens. Depois: só as não apagadas.

### message.deleted · servidor → cliente · novo

| Item | O que descreve |
| --- | --- |
| Quem recebe | Todos os Membros da Conversa no momento da publicação, em todas as abas |
| Autenticação | A da conexão (handshake da F03) |
| Carga | `event_id` (opcional) , `conversation_id` e `message_id` |
| Confirmação | Nenhuma |
| Erros | Nenhum |

O evento entra em `StoredEventPayloads` e é guardado e reenviado na reconexão.

## Verificação do contrato

- `deleted_at` e o `CHECK`: CA1.
- DELETE 204, 401, 403 e 404, o PATCH da apagada e o histórico sem ela: CA2.
- `message.deleted` para os Membros, nada para quem está fora e o reenvio: CA3.
- Edição e exclusão concorrentes: CA7.

## Decisões

- A exclusão reaproveita a leitura com trava de linha da edição (`lockOwnMessage`), que passa a
  tratar a Mensagem com `deleted_at` como inexistente; numa transação, grava `body = null` e
  `deleted_at`. A publicação usa o `publishToMembers` da edição.
- A coluna `body` da entidade passa a `string | null`; a `MessageView` e a resposta continuam com
  `body: string`, porque nenhuma rota devolve a Mensagem apagada (o histórico a filtra).
- O histórico filtra `deleted_at IS NULL` na mesma consulta; o índice `(conversation_id, id)`
  continua servindo, sem índice parcial, porque as apagadas são raras.
- Na web, o `ConfirmDialog` entra em `components/ui`, sobre o AlertDialog do `radix-ui`, com o foco em
  "Cancelar" (`onOpenAutoFocus`) e sem fechar pelo clique fora (comportamento do AlertDialog).
- O `message.deleted` é aplicado por `removeDeleted(pages, messageId)`, que também tira a Mensagem do
  buffer de Mensagens recentes do provedor e da lista de gravadas nesta abertura do histórico, para
  ela não voltar ao cache.
- A Server Action `deleteMessage` devolve `ok`, `not_found`, `forbidden`, `unauthenticated` ou
  `failure`; o `not_found` é tratado como sucesso (já apagada).
- O foco depois de apagar vai para o primeiro controle da Mensagem seguinte da lista, ou para a caixa
  de mensagem quando ela era a última.
- "Apagar" entra na lista de ações com o tom `danger`, só nas próprias Mensagens, e por isso aparece
  no menu, separado, e não na barra.
- A edição aberta de uma Mensagem que sai do cache (pelo `message.deleted` ou pelo `not_found` da
  edição) fecha, com o toast "Essa mensagem foi apagada".

## Arquivos e interfaces

- `apps/chat-api/migrations/<ts>-AddMessageDeletedAt.ts`: a coluna e o `CHECK`.
- `apps/chat-api/src/messages/message.entity.ts`: `deletedAt`, `body: string | null`.
- `apps/chat-api/src/messages/messages.service.ts`: `deleteMessage(personId, conversationId, id)`;
  o filtro do histórico; `lockOwnMessage` ignora a apagada.
- `apps/chat-api/src/messages/messages.controller.ts`: `DELETE :id` (204).
- `apps/chat-api/src/realtime/realtime.publisher.ts` e `realtime-socket.ts`: `messageDeleted` e o
  nome no registro.
- `packages/chat-events/index.d.ts`: `MessageDeletedEvent` e a entrada em `StoredEventPayloads`.
- `apps/web/src/app/services/chat-api.ts` e `actions/delete-message.ts`: `deleteMessage`.
- `apps/web/src/app/utils/message-pages.ts` e `recent-messages.ts`: `removeDeleted`, `forgetMessage`.
- `apps/web/src/app/components/realtime/realtime-provider.tsx`, `hooks/use-realtime-messages.ts`,
  `hooks/use-message-history.ts`: `onMessageDeleted` e `applyDeleted`.
- `apps/web/src/app/components/ui/confirm-dialog.tsx`: `ConfirmDialog`.
- `apps/web/src/app/components/message/delete-message-dialog.tsx`: o diálogo "Apagar mensagem?".
- `apps/web/src/app/components/message/message-actions.tsx`, `message-item.tsx`,
  `message-editor.tsx` e `components/conversation/message-history.tsx`: "Apagar", o foco depois de
  apagar e a edição que fecha.
- Testes: `test/messages-delete.e2e-spec.ts`, os de tempo real e do banco citados,
  `message-pages.test.ts` e os Playwright citados.

## Testes existentes que mudam

Nenhum. O teste do `CHECK` novo entra em `test/database.e2e-spec.ts`, que não testava o antigo.

## Mudança de dados

Nenhuma: as Mensagens que já existem continuam com texto e `deleted_at` nulo.

## Documentos atualizados

Nenhum no commit de plano: a spec e o LLD já registram a exclusão como planejada.
