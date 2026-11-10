# Plano da F06-T03: Editar a própria Mensagem

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma, página Telas, seção Conversa, e encontra o frame
"Conversa / Mensagem / Edição acima do limite", com a MessageEditor mostrando o contador "N
caracteres acima do limite", feito com os componentes e as variáveis do design system.

### CA2

**Marca:** teste HTTP

**Cenário:** Dada uma Mensagem enviada, quando o histórico ou o envio a devolvem, então ela traz
`edited_at` nulo; depois de editada, `edited_at` com a hora da edição.

**Teste previsto:** e2e da API, `test/messages-edit.e2e-spec.ts`, "edita o texto e grava
edited_at" e "o histórico traz edited_at".

### CA3

**Marca:** teste HTTP

**Cenário:** Dado o autor de uma Mensagem, quando ele a edita, então recebe 200 com o texto novo;
o mesmo texto responde 200 sem mudar `edited_at`; texto vazio ou acima de 4000 caracteres, 400;
outra Pessoa Membro, 403 `message_not_owned`; Mensagem inexistente, de outra Conversa, ou quem não
é Membro, 404 `message_not_found`; sem Sessão, 401. Duas edições ao mesmo tempo terminam sem
erro, com o texto de uma delas.

**Teste previsto:** e2e da API, `test/messages-edit.e2e-spec.ts`, "edita o texto e grava
edited_at", "o mesmo texto não muda edited_at", "recusa texto vazio ou acima do limite", "recusa a
Mensagem de outra Pessoa", "responde 404 para Mensagem inexistente, de outra Conversa ou de quem
não é Membro", "sem Sessão responde 401" e "duas edições ao mesmo tempo terminam sem erro".

### CA4

**Marca:** teste HTTP

**Cenário:** Com Membros e uma Pessoa de fora conectados, quando o autor edita, então os Membros
(inclusive outra aba do autor) recebem `message.updated` com a Mensagem inteira, e a Pessoa de
fora não; o mesmo texto não publica nada; o evento volta na reconexão com cursor.

**Teste previsto:** e2e da API, `test/realtime-messages.e2e-spec.ts`, "a edição emite
message.updated para os Membros", "editar com o mesmo texto não emite nada";
`test/realtime-recovery.e2e-spec.ts`, "a edição volta na reconexão".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dada uma Mensagem da Pessoa, quando ela escolhe "Editar" na barra ou no menu, então
o texto vira a caixa de edição com o foco no fim; Enter salva, Shift+Enter quebra a linha, Esc
cancela; vazio ou acima do limite não salva; enquanto salva, "Salvando"; na falha, o erro e
"Tentar de novo" com o texto mantido; editar outra fecha a primeira; ao fechar, o foco volta à
Mensagem. A Mensagem de outra Pessoa não tem "Editar".

**Teste previsto:** Playwright, `e2e/conversa/editar-mensagem.spec.ts`, "edita pela barra e
cancela com Esc", "não salva vazio nem acima do limite", "mostra a falha e tenta de novo" e "a
Mensagem de outra Pessoa não tem Editar".

### CA6

**Marca:** teste de unidade

**Cenário:** Dado o cache do histórico, quando chega `message.updated`, então a Mensagem é trocada
pelo id só se o `edited_at` do evento for posterior ao do cache; a atrasada é descartada; uma
Mensagem fora do cache não entra.

**Teste previsto:** Vitest, `src/app/utils/message-pages.test.ts`, "replaceEdited troca pelo id
só com edited_at mais novo", "descarta a edição atrasada" e "não insere Mensagem fora do cache".

### CA7

**Marca:** teste HTTP

**Cenário:** O dos CA3 e CA4, e o CA6.

**Teste previsto:** os dos CA3, CA4 e CA6.

### CA8

**Marca:** teste no Playwright

**Cenário:** Duas Pessoas no mesmo Canal: uma edita, e a outra vê o texto novo e "(editada)" sem
recarregar; o caminho só pelo teclado; o axe com a edição aberta, sem violações.

**Teste previsto:** Playwright, `e2e/tempo-real/edicao-sem-recarregar.spec.ts`, "a edição aparece
para a outra Pessoa sem recarregar"; `e2e/conversa/editar-mensagem.spec.ts`, "edita só pelo
teclado"; `e2e/acessibilidade/edicao-sem-violacoes.spec.ts`.

### CA9

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra as capturas de
"Editada", "Edição", "Edição salvando", "Edição com erro" e "Menu da própria mensagem", nos dois
temas, ao lado dos frames.

## Contrato

### messages · chat · alterada

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `edited_at` | timestamptz | sim | — | nova: a hora da última edição que mudou o texto |

### PATCH /v1/conversations/:conversationId/messages/:id · nova

| Item | O que descreve |
| --- | --- |
| Autenticação | Cookie de Sessão (guard da F01) |
| Parâmetros de caminho | `conversationId` e `id`, texto; malformados respondem 404 |
| Corpo da requisição | `body`, texto obrigatório, sem espaços nas pontas, de 1 a 4000 pontos de código, sem NUL |
| Resposta de sucesso | 200, `{ message }` |
| Erros | 400 `validation_failed`; 401 `unauthenticated`; 403 `message_not_owned`; 404 `message_not_found` |

### Mensagem no REST e nos eventos · alterada

Antes: `{ id, conversation_id, client_id, author, body, created_at }`. Depois: o mesmo, mais
`edited_at` (texto ISO ou `null`).

### message.updated · servidor → cliente · novo

| Item | O que descreve |
| --- | --- |
| Quem recebe | Todos os Membros da Conversa no momento da publicação, em todas as abas |
| Autenticação | A da conexão (handshake da F03) |
| Carga | `event_id` (opcional, ausente com o Redis fora) e `message` (a Mensagem inteira) |
| Confirmação | Nenhuma |
| Erros | Nenhum |

O evento entra em `StoredEventPayloads` e é guardado e reenviado na reconexão.

## Verificação do contrato

- `edited_at` nulo e preenchido: CA2.
- PATCH 200, o mesmo texto, 400, 401, 403, 404 e a concorrência: CA3.
- `message.updated` para os Membros, nada para quem está fora, nada no mesmo texto e o reenvio na
  reconexão: CA4.

## Decisões

- A edição é uma transação que lê a Mensagem com trava de linha (`FOR UPDATE`) pelo id e pela
  Conversa; a participação é conferida antes, pela operação "Conversa da qual a Pessoa é Membro",
  traduzindo `conversation_not_found` em `message_not_found`, para a resposta não revelar se a
  Conversa existe. A linha que não existe, de outra Conversa ou já apagada (`deleted_at`, quando a
  04 o criar) responde `message_not_found`; autor diferente, `message_not_owned`.
- `message_not_owned` (403) e `message_not_found` (404) entram em `ErrorCode`, no mapa de status e
  no de `detail` do filter.
- A publicação do `message.updated` sai depois do commit, como a do `message.created`, pelo
  publisher, com os ids de Membros lidos depois do commit; a falha só vai para o log.
- O DTO da edição reaproveita as regras do texto do envio (`Transform` de `trim`, `IsNotEmpty`,
  `MaxCodePoints`, `NoNullCharacter`), num DTO próprio só com `body`.
- Na web, a Server Action `editMessage` valida como a de envio e devolve `ok` (com a Mensagem),
  `invalid`, `not_found`, `forbidden`, `unauthenticated` ou `failure`.
- O `message.updated` é aplicado pela função pura `replaceEdited(pages, message)`, que só troca
  quando o `editedAt` do evento é posterior ao do cache, e também no buffer de Mensagens recentes
  do provedor, para uma Conversa que monta depois não mostrar o texto antigo.
- A MessageEditor reaproveita o contador de limite da caixa de mensagem e fica no lugar do corpo
  da MessageItem; a Conversa guarda o id da Mensagem em edição (uma por vez).
- "Editar" entra na lista de ações da MessageActions só quando o autor é a Pessoa logada, entre
  "Copiar texto" e "Mais ações", e no menu, na ordem do Figma.

## Arquivos e interfaces

- `apps/chat-api/migrations/<ts>-AddMessageEditedAt.ts`: a coluna `edited_at`.
- `apps/chat-api/src/messages/message.entity.ts`: `editedAt`.
- `apps/chat-api/src/messages/edit-message.dto.ts`: `EditMessageDto`.
- `apps/chat-api/src/messages/message-not-found.error.ts` e `message-not-owned.error.ts`.
- `apps/chat-api/src/messages/messages.service.ts`: `editMessage(personId, conversationId, id,
  body)`; `MessageView.editedAt`.
- `apps/chat-api/src/messages/messages.controller.ts`: `PATCH :id`.
- `apps/chat-api/src/messages/message.response.ts`: `edited_at`.
- `apps/chat-api/src/realtime/realtime.publisher.ts`: `messageUpdated`; `realtime-socket.ts`: o
  nome no registro de eventos guardados.
- `apps/chat-api/src/common/errors/`: os dois códigos.
- `packages/chat-events/index.d.ts`: `MessagePayload.edited_at`, `MessageUpdatedEvent` e a entrada
  em `StoredEventPayloads`.
- `apps/web/src/app/services/chat-api.ts`: `Message.editedAt`, `editMessage`.
- `apps/web/src/app/actions/edit-message.ts`: `editMessage`.
- `apps/web/src/app/utils/message-event.ts` e `message-pages.ts`: `editedAt`, `replaceEdited`.
- `apps/web/src/app/components/realtime/realtime-provider.tsx`: o tratamento de
  `message.updated` e `onMessageUpdated` no `RealtimeListener`.
- `apps/web/src/app/hooks/use-realtime-messages.ts`: aplica a edição no cache.
- `apps/web/src/app/components/message/message-editor.tsx`: `MessageEditor`.
- `apps/web/src/app/components/message/message-item.tsx`, `message-actions.tsx` e
  `components/conversation/message-history.tsx`: "Editar", a edição no lugar e "(editada)".
- Testes: `test/messages-edit.e2e-spec.ts`, os de tempo real citados, `message-pages.test.ts` e os
  Playwright citados.

## Testes existentes que mudam

- `test/messages.e2e-spec.ts` e `test/realtime-messages.e2e-spec.ts`: o corpo da Mensagem esperado
  ganha `edited_at: null` onde é comparado inteiro.

## Mudança de dados

Nenhuma: a coluna nasce nula para as Mensagens que já existem.

## Documentos atualizados

Nenhum no commit de plano: a spec e o LLD já registram a edição como planejada. A conclusão passa
a Situação para `existe` no LLD.
