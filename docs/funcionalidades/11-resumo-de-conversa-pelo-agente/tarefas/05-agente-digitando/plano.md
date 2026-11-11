# Plano da F11-T05: O Agente aparece digitando

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre o arquivo `slack` do Figma, página Telas, seção "Conversa", e encontra
os frames "Conversa / Lista / Agente digitando" e "Conversa / Lista / Agente digitando (escuro)"
(192:51184 e 192:51497): a Mensagem da Pessoa com a Menção ao Assistente e, na linha do
"digitando", acima da caixa de mensagem, "Assistente está digitando…", com as variables
`Semantic` no modo claro e no escuro. As capturas estão em `capturas/figma-agente-digitando-*.png`.

### CA2

**Marca:** teste HTTP

**Cenário:** Dado duas Pessoas com a mesma Conversa aberta, quando uma avisa que digita e depois que
parou, então a outra recebe `typing.start` e `typing.stop` com `author` `{ kind: "person", id,
name, username }` da Pessoa, e as abas da própria Pessoa não recebem nada; sair da Conversa ainda
emite o `typing.stop` com o mesmo `author`. As outras regras do "digitando" de Pessoa (sala,
participação, troca de Conversa) seguem provadas pelos casos que já existem.

**Teste previsto:** e2e da API, `test/realtime-typing.e2e-spec.ts`, "repassa o digitando aos outros
da sala, sem as abas da própria Pessoa" e "sair da Conversa avisa que parou de digitar", com a
asserção trocada de `person` para `author`.

### CA3

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open`, quando o bot chama `POST /v1/bot/requests/:id/typing` com a
credencial certa, então recebe 204. Sem a credencial ou com a errada, 401 `invalid_bot_token`; com
id desconhecido ou malformado, 404 `request_not_found`; com o Pedido `failed` ou `cancelled`, 409
`request_closed`; vencido, 410 `request_expired`. O "digitando" não grava nada em `bot_actions`.
A emissão (início e fim na resposta) é provada pelo socket, no CA5.

**Teste previsto:** e2e da API, `test/bot-typing.e2e-spec.ts`, novo, no molde do
`bot-requests.e2e-spec.ts`: "responde 204 sem gravar ação", "responde 401 invalid_bot_token sem a
credencial ou com a errada", "responde 404 request_not_found", "responde 410 request_expired depois
da validade" e "responde 409 request_closed com o Pedido encerrado".

### CA4

**Marca:** teste de unidade

**Cenário:** Dado um cliente da API do chat falso e um trabalho que dura alguns intervalos, quando
o Pedido roda dentro do aviso de digitando, então o primeiro aviso sai antes de o trabalho começar,
um novo sai a cada intervalo enquanto ele roda, e nenhum sai depois que ele termina, com sucesso ou
com erro. Um aviso recusado pela API do chat vai para o log e não interrompe o Pedido nem os avisos
seguintes. No teste de integração, a API falsa recebe `POST /v1/bot/requests/<id>/typing`, com a
credencial de bot, antes da `reply`.

**Teste previsto:** unidade, `tests/unit/test_typing_notice.py` ("avisa ao começar e a cada
intervalo", "para quando o trabalho termina", "para quando o trabalho falha", "um aviso recusado
não interrompe"); integração, `tests/integration/test_request_routes.py`, "aceita o Pedido e grava
a resposta como reply", com a asserção do `typing` antes da `reply`.

### CA5

**Marca:** teste HTTP

**Cenário:** Dado o servidor real, um Pedido `open` e um Membro com a Conversa aberta pelo
`socket.io-client`, quando o bot chama a rota de digitando, então o Membro recebe `typing.start`
com `conversation_id` e `author` `{ kind: "bot", id, name, username }` do bot. Quando o bot grava a
`reply`, então o Membro recebe `typing.stop` com o mesmo `author`. Quando o bot avisa de novo
depois da `reply`, então a rota responde 204 e o Membro não recebe outro `typing.start`. Um Membro
sem a Conversa aberta não recebe o "digitando".

**Teste previsto:** e2e da API, `test/realtime-bot.e2e-spec.ts`, "o digitando do bot chega com
author bot e para na resposta" e "o digitando depois da resposta não é emitido".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado a Ana e o Bruno num Canal, em dois contextos do navegador, e um bot com nome
"Assistente", quando a Ana envia uma Mensagem que cria um Pedido para o bot e o apoio de bot avisa
que digita, então o Bruno vê "Assistente está digitando…"; sem novo aviso, o aviso some depois da
`expiração do digitando`. Quando o bot avisa de novo e grava a resposta, então o aviso some na hora
e a Mensagem do Agente aparece. A validação visual, nos dois temas, fica em
`validacao-visual.md`, nesta pasta.

**Teste previsto:** Playwright, `e2e/agentes/agente-digitando.spec.ts`, "o Agente aparece digitando
e some sem renovação" e "o aviso do Agente some quando a resposta chega".

## Contrato

### POST /v1/bot/requests/:id/typing · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Credencial de bot, `Authorization: Bearer <CHAT_BOT_TOKEN>`, pelo `BotTokenGuard` do controller `/v1/bot` |
| Parâmetros de caminho | `id`: o identificador de pedido (UUID); malformado responde como desconhecido |
| Corpo da requisição | Nenhum |
| Resposta de sucesso | 204, sem corpo. Emite `typing.start` do bot à sala da Conversa do Pedido, a não ser que o Pedido já tenha `reply` ou `question` gravada |
| Erros | 401 `invalid_bot_token`; 404 `request_not_found`; 409 `request_closed`; 410 `request_expired` |

A ordem das recusas é a da `reply`: credencial, Pedido inexistente, encerrado, vencido.

### typing.start e typing.stop · servidor → cliente · alterados

| Item | Antes | Depois |
| --- | --- | --- |
| Quem recebe | As outras abas com a Conversa aberta, sem as da própria Pessoa | O mesmo para Pessoa; o do bot vai a todas as abas com a Conversa do Pedido aberta |
| Carga | `{ conversation_id, person: { id, name } }` | `{ conversation_id, author: { kind: "person" \| "bot", id, name, username } }`, com o `MessageAuthorPayload` do `packages/chat-events` |

O `typing.stop` do bot sai quando a `reply` é gravada pela primeira vez; a repetição não emite (ela
não grava). Os eventos do cliente para a API (`typing.start` e `typing.stop` com
`conversation_id`) não mudam.

## Verificação do contrato

- `POST .../typing` 204 e sem linha em `bot_actions`: CA3.
- 401 `invalid_bot_token`, 404 `request_not_found`, 409 `request_closed`, 410 `request_expired`:
  CA3.
- `typing.start` do bot com `author.kind` `bot` e o `typing.stop` na `reply`: CA5 (socket) e CA6
  (tela).
- O aviso depois da resposta, sem emissão: CA5.
- `typing.start` e `typing.stop` de Pessoa com `author`: CA2.

## Decisões

- **Carga com `author`.** `TypingEvent` passa a `{ conversation_id, author: MessageAuthorPayload }`
  e o `TypingPersonPayload` sai do `packages/chat-events`: é o formato do autor da F11-T01 (spec,
  ""Digitando" do bot"). O gateway monta o `author` da Pessoa do socket, que já tem o `username`.
- **Emissão do bot pelo `RealtimePublisher`.** Um método `botTyping(conversationId, author,
  'typing.start' | 'typing.stop')` emite à sala da Conversa, sem guardar nem reenviar, como o
  "digitando" de Pessoa. Ele não tem `except`: o bot não tem aba.
- **Rota no `BotController`, sem ação.** `POST requests/:requestId/typing` com `@HttpCode(204)`
  chama `BotActionsService.typing`, que, numa transação, trava o Pedido pelo `lockForAction` (as
  mesmas recusas, na mesma ordem) e confere se ele já tem `reply` ou `question` em `bot_actions`;
  depois do commit, emite o `typing.start` com o bot do Pedido, lido pelo `BotsService`. Nada é
  gravado.
- **O aviso depois da resposta não é emitido.** Resolve a decisão que a spec não cobre: a
  renovação do Serviço de agentes pode cruzar com a gravação da resposta, e um `typing.start`
  depois do `typing.stop` deixaria "Assistente está digitando…" ao lado da resposta até a
  expiração. Como o `lockForAction` põe as duas chamadas em fila, o aviso que trava depois da
  gravação a encontra e não emite. Registrado no LLD, "Digitando".
- **Fim na resposta.** `BotActionsService.reply`, quando grava, publica a Mensagem e emite o
  `typing.stop` com o `author` da Mensagem gravada. A F11-T07 faz o mesmo na `question`.
- **Renovação isolada no Serviço de agentes.** `app/agent_requests/typing_notice.py`,
  `while_typing(chat_api, request_id, work, interval=TYPING_INTERVAL_S)`: abre uma tarefa que avisa
  e dorme o intervalo em laço, aguarda o trabalho e cancela a tarefa no `finally`. O primeiro aviso
  sai antes de o trabalho começar. Um aviso que falha (`ChatApiError`) vai para o log como `warning`,
  sem texto de Mensagem, e o laço continua. A rota de Pedido agenda `while_typing(...,
  run_request(body, deps))`, então o `run_request`, que a F11-T06 muda, fica intocado. O nome do
  módulo evita sombrear o `typing` da biblioteca padrão.
- **Intervalo como constante.** `TYPING_INTERVAL_S = 3.0` no mesmo módulo, com o nome do LLD
  ("Intervalo do aviso de digitando"); o teste de unidade passa um intervalo curto.
- **Cliente.** `ChatApiClient.typing(request_id)` chama a rota e lança `ChatApiError` fora de 2xx,
  como as outras.
- **Web.** `useTypingPeople` lê `author` no lugar de `person`; o `Typer` continua `{ id, name }`, e
  o `useKnownNames` mantém o nome do evento para o bot, que não é Pessoa conhecida. O texto do
  aviso é o mesmo "<nome> está digitando…" (Figma, CA1); com mais de duas entradas, o
  "Várias pessoas estão digitando…" que existe.
- **Playwright sem o Serviço de agentes.** O teste cria o Pedido pela rota de envio da API do chat,
  com a Sessão da Ana e `agent_username` de um bot criado com `insertBot("Assistente")` (`@usuário`
  aleatório). Assim o BFF não chama o Serviço de agentes, e nenhuma renovação do modelo interfere
  na expiração; não depende do `agentsLock` nem do `assistente` conectado. O apoio ganha
  `botTyping(requestId)` em `e2e/support/bot.ts`.

## Arquivos e interfaces

- `packages/chat-events/index.d.ts`: `TypingEvent` com `author`; sai `TypingPersonPayload`.
- `apps/chat-api/src/realtime/realtime.gateway.ts`: `relayTyping` monta o `author` da Pessoa;
  `emitToConversation` (ou equivalente) para o publisher.
- `apps/chat-api/src/realtime/realtime.publisher.ts`: `botTyping(conversationId, author, name)`.
- `apps/chat-api/src/agent-requests/agent-requests.service.ts`: `hasAnswer(requestId)`.
- `apps/chat-api/src/bot/bot.controller.ts`: `POST typing`, 204.
- `apps/chat-api/src/bot/bot-actions.service.ts`: `typing(requestId)`; `reply` emite o fim.
- `apps/chat-api/src/bot/bot.module.ts`: importa `BotsModule` e `RealtimeModule`.
- `apps/chat-api/test/support/bot-routes.ts`: `botRoutes.typing`.
- `apps/chat-api/test/realtime-typing.e2e-spec.ts`, `bot-typing.e2e-spec.ts` (novo) e
  `realtime-bot.e2e-spec.ts`.
- `apps/agents/app/chat_api.py`: `typing(request_id)`.
- `apps/agents/app/agent_requests/typing_notice.py`: novo, `while_typing`, `TYPING_INTERVAL_S`.
- `apps/agents/app/agent_requests/routes.py`: agenda o Pedido dentro do `while_typing`.
- `apps/agents/tests/unit/test_typing_notice.py`: novo;
  `tests/integration/test_request_routes.py`.
- `apps/web/src/app/hooks/use-typing.ts`: `author` no lugar de `person`.
- `apps/web/e2e/support/bot.ts`: `botTyping`; `e2e/agentes/agente-digitando.spec.ts`: novo;
  `e2e/plano-de-testes-f11.md`: a seção da F11-T05.

## Testes existentes que mudam

- `apps/chat-api/test/realtime-typing.e2e-spec.ts`: as asserções de carga trocam `person` por
  `author`, com `kind` e `username`.
- `apps/agents/tests/integration/test_request_routes.py`: a API falsa passa a receber o `typing`
  além da `reply`; o caso que procura a `reply` filtra pelo caminho, se ainda não filtra.
- Os Playwright do "digitando" de Pessoa (`tempo-real/digitando.spec.ts`) não mudam: o texto na
  tela é o mesmo.

## Mudança de dados

Nenhuma.

## Documentos atualizados

- `docs/lld.md`, seção "Digitando": a Alteração `planejada` virou a regra, com o "digitando" do bot
  `planejado`, e entrou o aviso depois da resposta aceito sem emitir.
- `docs/lld.md`, seção "Valores e configuração": "Intervalo do aviso de digitando" passa a valer na
  web e no Serviço de agentes.
- Figma, seção "Conversa": os dois frames de CA1.
