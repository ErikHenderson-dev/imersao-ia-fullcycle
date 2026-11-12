# Plano da F13-T02: Resposta bloqueada para quem não tem Permissão de dados

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre a página "Telas" do Figma e encontra a seção "Consulta a dados (F13)",
com os frames `Conversa / Dados de negócio / <Estado>` nos temas claro e escuro, montados com
instâncias dos componentes locais (MessageItem, AgentText, ReplyQuote, QuickReplies): a resposta com
o número e a linha "Considerado: …", a comparação entre períodos, a Resposta bloqueada, a Citação de
uma Resposta bloqueada, a recusa por falta de permissão, a Pergunta pendente com as Respostas
prontas de período e com as de nome, o resultado vazio e o "Não consegui responder.", desenhados
antes do código da tela.

### CA2

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open`, quando o bot chama `reply` com `business_data: true`, então a
Mensagem gravada tem a marca e a resposta traz `business_data: true`; sem o campo, `false`; a
`question` com `business_data: true` também grava a marca; `business_data` que não é booleano
responde 400 `validation_failed`; e uma Pessoa que envia `business_data` no corpo de uma Mensagem
recebe a Mensagem gravada sem a marca.

**Teste previsto:** e2e da API, `test/business-data.e2e-spec.ts`, "reply com business_data grava a
marca", "reply sem business_data grava sem a marca", "question com business_data grava a marca",
"recusa business_data que não é booleano" e "Mensagem de Pessoa nunca tem a marca".

### CA3

**Marca:** teste HTTP

**Cenário:** Dado uma resposta do bot com a marca num Canal com a Ana (com Permissão de dados) e o
Bruno (sem), quando cada um lê o histórico, então a Ana recebe `blocked: false` com o texto e o
Bruno recebe `blocked: true`, `body` vazio, `quick_replies` nulo, o autor, a data e
`business_data: true`; quando a Ana cita a resposta e a Atividade do Bruno traz a Mensagem dela (com
Menção ao Bruno), então a `quote` sai com `blocked: true` e `body` vazio para o Bruno, e com o texto
para a Ana, no histórico e na Atividade; e a resposta da rota `reply` ao bot vem completa.

**Teste previsto:** e2e da API, `test/business-data.e2e-spec.ts`, "o histórico bloqueia a resposta
para quem não tem Permissão de dados", "a citação de uma resposta marcada sai bloqueada no
histórico e na Atividade" e "a rota do bot devolve a resposta completa".

### CA4

**Marca:** teste HTTP

**Cenário:** Dado o servidor real com a Ana e o Bruno conectados por `socket.io-client`, quando o
bot grava uma resposta com a marca, então a Ana recebe `message.created` completo e o Bruno
bloqueado; quando a Ana envia uma Mensagem que cita a resposta, cada um recebe `message.created`
com a sua versão da citação; e, depois de o Bruno cair e reconectar com o cursor anterior, o
reenvio entrega a ele as versões bloqueadas.

**Teste previsto:** e2e da API, `test/realtime-business-data.e2e-spec.ts`, "a resposta marcada
chega completa a quem tem permissão e bloqueada a quem não tem", "a Mensagem que cita a resposta
marcada leva a citação de cada um" e "a reconexão reenvia a versão de cada Pessoa".

### CA5

**Marca:** documento

**Cenário:** Quem revisa abre `packages/chat-events/index.d.ts` e encontra `business_data` e
`blocked` em `MessagePayload` e na citação não apagada (`QuotePayload`).

### CA6

**Marca:** teste HTTP

**Cenário:** Dado o Bruno com Permissão de dados e uma resposta marcada, quando quem opera tira a
permissão dele e ele lê o histórico de novo, então recebe a versão bloqueada.

**Teste previsto:** e2e da API, `test/business-data.e2e-spec.ts`, "tirar a Permissão de dados
bloqueia a próxima leitura".

### CA7

**Marca:** teste de unidade

**Cenário:** Dado uma Mensagem com `blocked`, quando a web escolhe o que mostrar e o que copiar,
então mostra e copia o aviso "Resposta com dados de negócio. Você não tem permissão para vê-la.", e
sem `blocked`, o texto; a citação com `blocked` mostra o aviso no lugar do texto. O Playwright de
CA9 prova a tela.

**Teste previsto:** Vitest, `src/app/utils/business-data.test.ts`, "a Mensagem bloqueada mostra e
copia o aviso", "a Mensagem completa mostra e copia o texto" e "a citação bloqueada mostra o aviso".

### CA8

**Marca:** teste de unidade

**Cenário:** Dado a citação de uma Mensagem com `business_data`, quando o BFF monta o Pedido, então
`quote` vai nula, mesmo com a citação completa (quem pede tem Permissão de dados); uma citação sem
a marca segue como hoje.

**Teste previsto:** Vitest, `src/app/utils/agent-mentions.test.ts`, "a citada com Dados de negócio
não vai ao Agente".

### CA9

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` conectado com o bot criado, a Ana com Permissão de dados e o Bruno
sem, num Canal, em dois contextos do navegador, quando a Ana menciona o Agente e o bot grava, pela
rota `/v1/bot/.../reply`, uma resposta com a marca, então a Ana vê o texto e o Bruno vê o aviso, sem
recarregar; depois de recarregar, o Bruno continua vendo o aviso; quando a Ana responde citando a
resposta, o Bruno vê a citação com o aviso; "Copiar texto" na resposta, pelo teclado, copia o
aviso para o Bruno; e a checagem com `@axe-core/playwright` na Conversa com uma resposta completa e
uma bloqueada não tem violações nos dois temas. Os testes HTTP de CA2 a CA6 e os de unidade de CA7
e CA8 completam o critério.

**Teste previsto:** Playwright, `e2e/agentes/resposta-bloqueada.spec.ts`, "a resposta marcada
aparece bloqueada para quem não tem Permissão de dados, sem recarregar e depois de recarregar", "a
citação da resposta marcada aparece bloqueada", "copiar a resposta bloqueada copia o aviso" e
`e2e/acessibilidade/resposta-bloqueada.spec.ts`, "a Conversa com resposta completa e bloqueada
passa no axe nos dois temas", com os casos no `e2e/plano-de-testes-f13.md`.

### CA10

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md` nesta pasta e encontra a comparação da Resposta
bloqueada e da Citação bloqueada em 1440 × 900, nos dois temas, com as capturas do código e do
Figma; e abre o LLD e encontra `business_data` em "Dados", a ação com `business_data` em
"Interfaces" e o bloqueio por leitor em "Segurança" como `existe`.

## Contrato

### POST /v1/bot/requests/:id/reply · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Corpo da requisição | `body` | `body`; `business_data?: boolean`, falso quando ausente |
| Resposta de sucesso | 201 `{ message }` | 201 `{ message }`, com `message.business_data` e `message.blocked: false` (o bot lê tudo) |
| Erros | — | 400 `validation_failed` também para `business_data` que não é booleano |

Na repetição da ação, a Mensagem já gravada volta como está, e o `business_data` novo é ignorado,
como o texto.

### POST /v1/bot/requests/:id/question · alterada

As mesmas mudanças de `reply`: `business_data?: boolean` no corpo e os dois campos na Mensagem.

### Mensagem no REST · alterada

Vale para toda rota que devolve Mensagem (histórico, envio, edição, Atividade e rotas do bot).

| Item | Antes | Depois |
| --- | --- | --- |
| `message` | `{ …, body, quote, quick_replies }` | `{ …, body, quote, quick_replies, business_data: boolean, blocked: boolean }`; com `blocked: true`, `body` é `""` e `quick_replies` é `null` |
| `quote` não apagada | `{ id, deleted: false, author, body }` | `{ id, deleted: false, author, body, business_data: boolean, blocked: boolean }`; com `blocked: true`, `body` é `""` |

### message.created e message.updated · servidor → cliente · alterados

| Item | Antes | Depois |
| --- | --- | --- |
| Carga | a mesma `message` para todos os Membros | `message` no formato acima; quando a Mensagem tem a marca ou cita uma Mensagem com a marca, montada para cada Membro com a Permissão de dados dele, lida na publicação |
| Quem recebe | os Membros | os mesmos; o evento guardado para a reconexão de cada Pessoa é a versão dela |

### messages · chat · alterada

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `business_data` | `boolean` | não | `false` | nova; marca "dados de negócio", gravada só pela ação de bot |

## Verificação do contrato

- `reply` com e sem `business_data`, 201: CA2; 400 com valor não booleano: CA2; resposta completa
  ao bot: CA3.
- `question` com `business_data`: CA2.
- Mensagem no REST com `blocked` no histórico: CA3 e CA6; na Atividade e na citação: CA3.
- `message.created` por Pessoa e na reconexão: CA4. `message.updated` por Pessoa: sai pelo mesmo
  caminho de montagem por leitor que o `message.created`, e o caso que o publica para uma Mensagem
  com a marca é a pergunta encerrada (`publishQuestionClosed`), que a F13-T05 exercita com a
  pergunta de nome; nesta tarefa ele não tem teste próprio, porque nenhuma Mensagem com a marca é
  editada nem encerrada sem a T05.
- `messages.business_data` com o padrão `false`: CA2 (Mensagem de Pessoa).

## Decisões

- A `MessageView` interna ganha `businessData`, e a citação interna (`QuoteView`) deixa de ser o
  `QuotePayload` e ganha `businessData`; `toMessageResponse(message, reader)` recebe
  `reader: { dataAccess: boolean }` e monta `blocked` e os campos vazios. As rotas do bot passam um
  leitor com acesso (`BOT_READER`), porque a resposta vai ao próprio bot que a escreveu.
- A carga por Pessoa só é montada quando a Mensagem ou a citada tem a marca; as outras seguem com
  a carga única, sem leitura a mais. A Permissão de dados dos Membros vem de uma consulta só,
  `PeopleService.filterWithDataAccess(ids)`, no momento da publicação.
- `RealtimePublisher.messageCreated` e `messageUpdated` passam a aceitar a carga única ou a função
  por Pessoa, como `memberAdded`.
- O DTO de envio de Mensagem de Pessoa não ganha `business_data`: o `ValidationPipe` com
  `whitelist` descarta o campo, e o service grava a Mensagem de Pessoa sempre com `false`.
- Na web, o aviso e a escolha entre texto e aviso ficam em `src/app/utils/business-data.ts`
  (`BLOCKED_NOTICE`, `messageDisplayText`, `quoteDisplayText`), e "Copiar texto" usa
  `messageDisplayText`. A Mensagem bloqueada mostra o aviso em `text-fg-muted` itálico, no lugar do
  AgentText, sem Respostas prontas; a citação bloqueada mostra o autor e o aviso, ainda como botão
  que leva à original.
- `agentRequestQuote` devolve `null` quando a citação tem `business_data`.
- O Figma ganha a seção "Consulta a dados (F13)" na página "Telas", com frames de 1440 × 900 só da
  área da Conversa necessária, montados com os componentes locais, e o MessageItem não ganha
  variant nova: a Resposta bloqueada é um MessageItem de bot com o texto do aviso no estilo
  `body/italic` muted, desenhado nos frames.

## Arquivos e interfaces

- `packages/chat-events/index.d.ts`: `MessagePayload.business_data`, `blocked`; `QuotePayload`
  não apagada com os dois.
- API do chat:
  - `src/messages/message.entity.ts`: `businessData: boolean`.
  - `src/messages/messages.service.ts`: `MessageView.businessData`, `QuoteView` interna,
    `publishMessageEvent` por leitor quando há marca.
  - `src/messages/message.response.ts`: `toMessageResponse(message, reader)`, `MessageReader`,
    `BOT_READER`.
  - `src/messages/messages.controller.ts`, `src/activity/activity.controller.ts` e
    `activity.response.ts`, `src/bot/bot.controller.ts`: passam o leitor.
  - `src/bot/reply.dto.ts`, `question.dto.ts`: `business_data`.
  - `src/bot/bot-actions.service.ts`: `reply(requestId, body, businessData)` e
    `question(..., businessData)`.
  - `src/people/people.service.ts`: `filterWithDataAccess(ids): Promise<Set<string>>`.
  - `src/realtime/realtime.publisher.ts`: `messageCreated`/`messageUpdated` com carga por Pessoa.
  - `migrations/1794510000000-AddMessageBusinessData.ts`.
  - `test/business-data.e2e-spec.ts`, `test/realtime-business-data.e2e-spec.ts`,
    `test/support/bot-routes.ts` (o atalho `reply` com `business_data`).
- Web:
  - `src/app/services/chat-api.ts`: `Message.businessData`, `blocked`.
  - `src/app/utils/message-event.ts`: os dois campos, falsos no evento guardado antes da F13.
  - `src/app/utils/business-data.ts` e `business-data.test.ts`.
  - `src/app/components/message/message-item.tsx`, `reply-quote.tsx`, `message-actions.tsx`.
  - `src/app/utils/agent-mentions.ts` e o teste.
  - `e2e/agentes/resposta-bloqueada.spec.ts`, `e2e/acessibilidade/resposta-bloqueada.spec.ts`,
    `e2e/support/bot.ts` (resposta com a marca), `e2e/support/database.ts` (Permissão de dados),
    `e2e/plano-de-testes-f13.md`.

## Testes existentes que mudam

- Os testes da API do chat que conferem a Mensagem ou a citação com `toEqual` passam a esperar
  `business_data: false` e `blocked: false`, porque os campos são novos em toda Mensagem.
- Os testes Vitest que montam `Message` à mão ganham os dois campos, pelo tipo.

## Mudança de dados

Nenhuma: a migração dá `false` às Mensagens que já existem.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra `business_data` em "Dados", o campo nas ações em
"Interfaces" e o bloqueio por leitor em "Segurança" e "Concorrência e idempotência" como
`planejado`. No fim da tarefa, eles passam a `existe` pela skill `lld`.
