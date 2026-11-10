# Plano da F07-T02: Ler a Conversa

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado um Canal com Mensagens Não lidas de outra Pessoa, quando a Pessoa grava a leitura
até a última, então recebe 200 com a Última leitura nova e os números zerados, e a lista passa a
mostrar o mesmo; dada uma posição igual ou anterior à gravada, responde 200 com a posição e os
números atuais, sem voltar a Última leitura; uma Mensagem apagada vale como posição; Mensagem
inexistente ou de outra Conversa responde 404 `message_not_found`; quem não é Membro, 404
`conversation_not_found`; `message_id` que não é uuid, 400 `validation_failed`; sem Sessão, 401.

**Teste previsto:** e2e da API, `test/read.e2e-spec.ts`, "grava a leitura e zera os números",
"uma posição anterior não volta a Última leitura", "a Mensagem apagada vale como posição",
"responde 404 para Mensagem inexistente ou de outra Conversa", "responde 404 para quem não é Membro",
"responde 400 sem uuid" e "responde 401 sem Sessão".

### CA2

**Marca:** revisão humana

**Cenário:** Quem revisa abre a Server Action `markConversationRead` e o service do BFF e encontra a
união discriminada da F01 (`ok` com os números, `unauthenticated`, `not_found`, `invalid`,
`failure`), e o cliente levando o `unauthenticated` a `redirectToExpiredSession()`.

### CA3

**Marca:** teste no Playwright

**Cenário:** O do CA6, que depende do hook de foco: com a aba visível e em foco, a Conversa fica
lida; com a aba escondida, não.

**Teste previsto:** os do CA6.

### CA4

**Marca:** teste de unidade

**Cenário:** Dada a Última leitura conhecida, quando a Mensagem salva mais nova é posterior, então
há o que informar, e quando é igual ou anterior, ou não há Mensagem, não há; dado o último envio,
quando o intervalo de 1 s não passou, a próxima chamada espera o resto dele, e quando passou, sai na
hora.

**Teste previsto:** Vitest, `src/app/utils/read-report.test.ts`, "há o que informar só com uma
Mensagem posterior à Última leitura" e "espera o resto do intervalo desde o último envio".

### CA5

**Marca:** teste de unidade

**Cenário:** Dado um Canal com Menções e uma Conversa direta com Não lidas, quando a Conversa está
aberta com a aba em foco, então a linha não fica em negrito, não tem contador nem texto para o
leitor de tela; fechada ou com a aba sem foco, mostra os números.

**Teste previsto:** Vitest, `src/app/utils/unread.test.ts`, "a Conversa aberta em foco não mostra
negrito nem contador".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado um Canal com uma Menção Não lida, quando a Pessoa o abre e depois recarrega a
página em outra Conversa, então a linha do Canal está sem negrito e sem contador; dada uma aba com a
visibilidade escondida e sem foco, quando ela abre outro Canal com Não lidas, então, ao recarregar
numa aba em foco, esse Canal continua Não lido.

**Teste previsto:** Playwright, `e2e/nao-lidas/ler-a-conversa.spec.ts`, "abrir o Canal o deixa
lido" e "a aba em segundo plano não marca como lida".

## Contrato

### PUT /v1/conversations/:conversationId/read · nova

| Item | O que descreve |
| --- | --- |
| Autenticação | Sessão (guard da F01) |
| Parâmetros de caminho | `conversationId`, uuid |
| Corpo da requisição | `message_id`, uuid, obrigatório |
| Resposta de sucesso | 200 com `conversation_id`, `last_read_message_id` (uuid ou nulo), `unread_count` e `mention_count` (inteiros de 0 a 100) |
| Erros | 400 `validation_failed`; 401 `unauthenticated`; 404 `conversation_not_found` (não é Membro, ou id malformado); 404 `message_not_found` (Mensagem inexistente ou de outra Conversa) |

### Server Action markConversationRead (BFF) · nova

Chama `PUT /v1/conversations/:conversationId/read` com o cookie da Sessão. Devolve `ok` com
`lastReadMessageId`, `unreadCount` e `mentionCount`; 401 vira `unauthenticated`, 404 vira
`not_found`, entrada que não é texto vira `invalid`, o resto vira `failure`.

## Verificação do contrato

- `PUT .../read`, 200, os dois 404, 400 e 401: CA1.
- A Server Action: CA2 e CA6.

## Decisões

- A rota fica no módulo de Mensagens, num controller próprio (`ReadController`, caminho
  `conversations/:conversationId/read`): ele já confere a participação pelo service de Conversas e é
  dono da tabela de Mensagens, que diz se a Mensagem é da Conversa; o avanço é o
  `ConversationsService.advanceLastRead` da 01, e os números saem do `UnreadCounter` da 01,
  exportado pelo módulo de Conversas.
- A rota não abre transação: o avanço é um `UPDATE` condicional só, e a contagem logo depois lê o
  que está gravado.
- O cliente conhece a Última leitura pela lista de Conversas: a página da Conversa lê a lista (o
  `cache` do React a divide com o layout) e passa a Última leitura ao histórico. A 04 usa o mesmo
  valor.
- A posição informada é a da Mensagem salva mais nova da lista carregada; a comparação com a Última
  leitura é a dos ids como texto, que no UUID v7 em minúsculas segue a ordem de criação.
- O agrupamento: o primeiro aviso sai na hora; os seguintes esperam o resto de 1 s desde o último
  envio e mandam a posição mais nova desse momento. Funções puras decidem se há o que informar e
  quanto esperar.
- O `ok` aplica os números na lista pelo `mutate` global do SWR: o histórico tem um provedor de
  cache próprio, e a lista mora no global.
- O foco é um hook (`useTabFocus`) com `useSyncExternalStore` sobre `visibilitychange`, `focus` e
  `blur`, com o servidor dizendo "sem foco".
- A regra de exibição da Conversa aberta em foco entra em `unreadDisplay` como um argumento; a lista
  de Conversas o calcula pelo caminho aberto e pelo hook de foco, e a seção recolhida usa a mesma
  regra.
- O teste da aba em segundo plano substitui `document.visibilityState` e `document.hasFocus` por um
  script de inicialização da página: no Chromium sem interface, toda página diz que está visível e
  em foco.

## Arquivos e interfaces

- `apps/chat-api/src/messages/read.controller.ts`: `ReadController`, `PUT`.
- `apps/chat-api/src/messages/read-conversation.dto.ts`: `message_id` uuid.
- `apps/chat-api/src/messages/messages.service.ts`: `markRead(personId, conversationId, messageId)`.
- `apps/chat-api/src/messages/messages.module.ts`: o controller.
- `apps/chat-api/src/conversations/conversations.module.ts`: exporta o `UnreadCounter`.
- `apps/web/src/app/services/chat-api.ts`: `markConversationRead(token, conversationId, messageId)`.
- `apps/web/src/app/actions/mark-conversation-read.ts`: a Server Action.
- `apps/web/src/app/hooks/use-tab-focus.ts`: `useTabFocus()`.
- `apps/web/src/app/hooks/use-read-report.ts`: `useReadReport(conversationId, newestSavedId,
  initialLastReadId, isReady)`.
- `apps/web/src/app/utils/read-report.ts`: `hasUnreadToReport` e `readReportDelay`.
- `apps/web/src/app/utils/unread.ts`: `unreadDisplay(conversation, isOpenAndFocused)`.
- `apps/web/src/app/utils/conversation-list.ts`: `applyUnread(list, conversationId, unread)`.
- `apps/web/src/app/(app)/conversas/[id]/page.tsx` e
  `components/conversation/message-history.tsx`: a Última leitura inicial e o hook.
- `apps/web/src/app/components/workspace-nav/conversation-list.tsx`: a Conversa aberta em foco.

## Testes existentes que mudam

Nenhum: abrir uma Conversa passa a lê-la, e nenhum teste atual confere Não lidas de uma Conversa
aberta.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum: a spec da F07 e o LLD já descrevem a rota, a Server Action, o foco e o intervalo.
