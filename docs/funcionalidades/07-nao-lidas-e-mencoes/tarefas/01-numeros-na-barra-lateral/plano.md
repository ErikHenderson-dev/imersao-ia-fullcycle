# Plano da F07-T01: Números na barra lateral

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma, página Telas, e encontra a barra lateral com uma Conversa
direta com contador de Não lidas e a "Casca / Sidebar / Seção recolhida" (25:20813) com as
Conversas Não lidas visíveis, nos dois temas.

### CA2

**Marca:** teste HTTP

**Cenário:** Dado um Canal com Mensagens e uma participação sem Última leitura, quando o
preenchimento da migração roda para esse Canal, então a participação fica na última Mensagem dele,
apagada ou não; numa Conversa sem Mensagens, fica nula.

**Teste previsto:** e2e da API, `test/database.e2e-spec.ts`, "o preenchimento da Última leitura
põe cada participação na última Mensagem da Conversa".

### CA3

**Marca:** teste HTTP

**Cenário:** Dado um Canal privado com Mensagens, quando uma Pessoa é adicionada a ele, então ela
não tem Não lidas; dado um Canal público com Mensagens, a conta nova também não; dada uma Conversa
direta aberta por uma Pessoa, quando ela envia a primeira Mensagem, então a outra Pessoa tem essa
Mensagem como Não lida.

**Teste previsto:** e2e da API, `test/unread.e2e-spec.ts`, "quem é adicionado a um Canal privado
começa sem Não lidas", "a conta nova começa sem Não lidas nos Canais públicos" e "a primeira
Mensagem da Conversa direta é Não lida para a outra Pessoa".

### CA4

**Marca:** teste HTTP

**Cenário:** Dado um Canal com Mensagens de outra Pessoa ainda não lidas, quando a Pessoa envia uma
Mensagem nele, então a Última leitura dela vai até a própria Mensagem e as Não lidas zeram; o
reenvio do mesmo `client_id` depois de uma Mensagem nova de outra Pessoa não volta nem avança a
Última leitura.

**Teste previsto:** e2e da API, `test/unread.e2e-spec.ts`, "enviar avança a Última leitura do
autor" e "o reenvio não muda a Última leitura".

### CA5

**Marca:** teste HTTP

**Cenário:** Dado um Canal e uma Conversa direta, quando outras Pessoas enviam, editam e apagam
Mensagens, então `GET /v1/conversations` traz, em cada Conversa, a Última leitura e os números:
contam as Mensagens de outros posteriores à Última leitura; as próprias, as apagadas e as
anteriores não; a Menção repetida conta uma vez; a Menção a si mesma e a Conversa direta consigo
mesma não contam; acrescentar uma Menção numa edição soma, tirar desconta, e apagar a Não lida
tira das duas contagens; com 101 Não lidas, as duas contagens param em 100.

**Teste previsto:** e2e da API, `test/unread.e2e-spec.ts`, "conta as Não lidas de outros depois da
Última leitura", "a Menção conta uma vez por Mensagem", "a própria Menção e a Conversa consigo
mesma não contam", "a edição e a exclusão corrigem os números" e "as contagens param em 100".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado um Canal com uma Menção Não lida e uma Conversa direta com duas Não lidas, quando
a Pessoa recarrega a página, então o Canal aparece em negrito com o contador 1 e a Conversa direta
em negrito com o contador 2; um Canal só com Não lidas sem Menção aparece em negrito, sem contador.

**Teste previsto:** Playwright, `e2e/nao-lidas/barra-lateral.spec.ts`, "mostra a Menção no Canal e
as Não lidas na Conversa direta"; Vitest, `src/app/utils/unread.test.ts`, para o `99+` e o que a
linha exibe.

### CA7

**Marca:** teste de unidade

**Cenário:** Dado um Canal com Não lidas e Menções, um Canal só com Não lidas e uma Conversa direta
com Não lidas, quando a linha monta o rótulo, então ele diz "geral, não lidas, 2 menções",
"frontend, não lidas" e "Alfredo Luiz, 3 mensagens não lidas", no singular com 1 e com "mais de 99"
acima de 99; sem Não lidas, só o nome.

**Teste previsto:** Vitest, `src/app/utils/unread.test.ts`, "monta o rótulo da linha para o leitor
de tela".

### CA8

**Marca:** teste no Playwright

**Cenário:** Dado um Canal com Não lidas e outro sem, quando a Pessoa recolhe a seção "Canais",
então só o Canal com Não lidas continua visível, em negrito e com o contador.

**Teste previsto:** Playwright, `e2e/nao-lidas/barra-lateral.spec.ts`, "a seção recolhida mostra
só as Conversas Não lidas".

### CA9

**Marca:** teste no Playwright

**Cenário:** O dos CA6 e CA8, e o axe na barra lateral com Não lidas, sem violações.

**Teste previsto:** os do CA6 e CA8, e `e2e/acessibilidade/nao-lidas-sem-violacoes.spec.ts`.

### CA10

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra as capturas da barra
lateral com Não lidas, da seção recolhida e da Conversa direta com contador, nos dois temas, ao lado
dos frames.

## Contrato

### conversation_members · chat · alterada

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `last_read_message_id` | uuid | sim | — | nova: a Última leitura; referência a `messages`, `ON DELETE NO ACTION` (a exclusão de Mensagem é lógica) |

- Sem índice novo: a coluna só é lida junto da participação, pela única
  `(conversation_id, person_id)`.

### GET /v1/conversations · alterada

| Item | Mudança |
| --- | --- |
| Resposta de sucesso | Cada Conversa ganha `last_read_message_id` (uuid ou nulo), `unread_count` e `mention_count` (inteiros de 0 a 100) |

A Conversa de `GET /v1/conversations/:id` e a do `conversation.member_added` não mudam.

### GET /api/conversations (BFF) · alterada

Repassa os três campos, como `lastReadMessageId`, `unreadCount` e `mentionCount`.

## Verificação do contrato

- `last_read_message_id` e o preenchimento: CA2; a posição inicial: CA3; o avanço no envio: CA4.
- Os três campos da lista e o teto: CA5.
- Os campos no BFF: CA6.

## Decisões

- A contagem fica numa classe do módulo de Conversas, `UnreadCounter`, com SQL que cruza
  `conversation_members`, `messages` e `message_mentions`, como a busca de Membros por @usuário já
  cruza `people`: o módulo de Mensagens depende do de Conversas, e o contrário criaria um ciclo. Ela
  conta para uma lista de pares (Conversa, Pessoa), numa consulta só, com uma subconsulta lateral
  limitada a 100 por par; a lista usa os pares da Pessoa, e a 03 usa os Membros de uma Conversa.
- A Última leitura inicial é gravada no próprio `INSERT` da participação: a última Mensagem da
  Conversa (`ORDER BY id DESC LIMIT 1`, porque o Postgres não tem `max(uuid)`), ou nula; a outra
  Pessoa da Conversa direta, na primeira Mensagem, entra sempre nula.
- O avanço é `ConversationsService.advanceLastRead(conversationId, personId, messageId)`, um
  `UPDATE` condicional que diz se gravou; o envio o chama na transação, só quando a Mensagem é nova.
  A 02 reaproveita o mesmo método.
- O preenchimento da migração é uma função exportada pela migração, que aceita uma lista opcional
  de Conversas: a migração a chama sem lista, e o teste, só com a Conversa dele, porque as suítes
  rodam em paralelo no mesmo banco.
- O tipo da lista no REST é a Conversa do `chat-events` mais os três campos, no módulo de Conversas
  da API; o evento não muda. Na web, o `Conversation` ganha os três campos; a Conversa que chega
  pelo `conversation.member_added` entra com zero e nula, e a lista é buscada de novo para trazer
  os números certos (é raro, e a busca já existe no `reset`).
- A linha decide o que exibe por uma função pura (`unreadDisplay`): negrito com Não lidas;
  contador de Menções no Canal e de Não lidas na Conversa direta; o rótulo do leitor de tela. A 02
  acrescenta a Conversa aberta em foco a ela.
- O rótulo vai no `aria-label` do link, e o CountBadge fica `aria-hidden`, para o número não ser
  lido duas vezes.
- A seção recolhida recebe as linhas Não lidas à parte e as mostra no lugar da lista escondida.

## Arquivos e interfaces

- `apps/chat-api/migrations/<ts>-AddMemberLastRead.ts`: a coluna, a referência e
  `backfillLastRead(queryRunner, conversationIds?)`.
- `apps/chat-api/src/conversations/conversation-member.entity.ts`: `lastReadMessageId`.
- `apps/chat-api/src/conversations/unread-counter.ts`: `UnreadCounter.countFor(pairs)` →
  `Map` de `{ lastReadMessageId, unreadCount, mentionCount }`.
- `apps/chat-api/src/conversations/conversations.service.ts`: `insertMembers` com a Última leitura
  inicial; `advanceLastRead`; `listSummariesForMember` com os números.
- `apps/chat-api/src/conversations/conversation.response.ts` e `conversations.controller.ts`: a
  Conversa da lista com os três campos.
- `apps/chat-api/src/conversations/unread-values.ts`: `UNREAD_COUNT_LIMIT = 100`.
- `apps/chat-api/src/messages/messages.service.ts`: o envio avança a Última leitura do autor.
- `apps/web/src/app/services/chat-api.ts`: o `Conversation` com os três campos.
- `apps/web/src/app/utils/unread.ts`: `unreadDisplay(conversation)` e `formatCount(n)`.
- `apps/web/src/app/utils/conversation-list.ts`: a Conversa nova entra com zero.
- `apps/web/src/app/components/ui/count-badge.tsx`: CountBadge.
- `apps/web/src/app/components/workspace-nav/sidebar-row.tsx`, `sidebar-section.tsx` e
  `conversation-list.tsx`: o estado Não lida, o rótulo e a seção recolhida.

## Testes existentes que mudam

- `apps/web/src/app/utils/conversation-list.test.ts`: as Conversas de exemplo ganham os três
  campos.
- Os e2e da API que comparam a lista inteira (`test/conversations.e2e-spec.ts`) passam a esperar os
  três campos.

## Mudança de dados

O preenchimento da migração põe cada participação que já existe na última Mensagem da Conversa.

## Documentos atualizados

Nenhum: a spec da F07 e o LLD já descrevem a Última leitura, a contagem e os campos da lista.
