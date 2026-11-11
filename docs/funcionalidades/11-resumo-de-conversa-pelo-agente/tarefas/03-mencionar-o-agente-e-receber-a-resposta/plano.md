# Plano da F11-T03: Mencionar o Agente e receber a resposta na Conversa

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado um Membro de um Canal e o bot de um Agente, quando ele envia uma Mensagem com
`agent_username` igual ao `@usuário` do bot, então a resposta traz `agent_request` com `kind`
`new`, o `bot_username` e `parent_request_id` nulo, e o banco tem o Pedido `open`, com quem pediu,
o bot, a Mensagem do Pedido e `expires_at` 2 min depois da criação. Quando o mesmo `client_id` é
reenviado, então a resposta traz o mesmo `agent_request` e não há segundo Pedido. Quando
`agent_username` não é de um bot (uma Pessoa ou ninguém), então recebe 422 `bot_not_found` e nada é
gravado. Sem `agent_username`, `agent_request` é nulo e nenhum Pedido é criado.

**Teste previsto:** e2e da API, `test/agent-requests.e2e-spec.ts`, "o envio com agent_username
cria um Pedido new", "o reenvio devolve o mesmo Pedido", "responde 422 bot_not_found quando
agent_username não é de um bot" (parametrizado: Pessoa e inexistente) e "sem agent_username,
agent_request é nulo".

### CA2

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open` criado pelo envio, quando o bot chama
`POST /v1/bot/requests/:id/reply` sem `Authorization` ou com a credencial errada, então recebe 401
`invalid_bot_token`. Com a credencial certa, então recebe 201 com a Mensagem de autor
`{ kind: "bot" }` na Conversa do Pedido, e ela aparece no histórico; repetida com outro texto,
recebe a mesma Mensagem e o banco continua com uma Mensagem de bot só. Com id desconhecido ou
malformado, `request_not_found` (404); com o Pedido vencido (`expires_at` no passado), 410
`request_expired`; com o Pedido `failed` ou `cancelled`, 409 `request_closed`. Sem `CHAT_BOT_TOKEN`,
a API não sobe e diz o nome da variável. Com o servidor real, a resposta chega como
`message.created` ao socket de um Membro, com o autor `bot`, e o repetido não publica de novo.

**Teste previsto:** e2e da API, `test/bot-requests.e2e-spec.ts` ("responde 401 invalid_bot_token
sem a credencial ou com a errada", "grava a resposta como bot na Conversa do Pedido", "repetir
devolve a mesma Mensagem", "responde 404 request_not_found", "responde 410 request_expired depois
da validade", "responde 409 request_closed com o Pedido encerrado"),
`test/realtime-bot.e2e-spec.ts` ("a resposta do bot chega como message.created aos Membros") e
`test/startup.e2e-spec.ts` (o caso de `CHAT_BOT_TOKEN` no parametrizado).

### CA3

**Marca:** teste de unidade

**Cenário:** Dado o texto e a lista de Agentes do registro, quando o BFF procura o Agente
mencionado, então devolve o `@usuário` de um Agente conectado escrito com `@` e no limite de
palavra (`@assistente`, `Oi @assistente,`), e nada para um Agente desconectado, para `e-mail@assistente`,
`@assistentes`, um `@assistente` dentro de um link, ou com a lista indisponível (registro fora).
Dado um texto sem `@`, então o registro nem é consultado. O caminho com `agent_request` chamando
`POST /v1/requests` é provado pelo Playwright de CA7.

**Teste previsto:** Vitest, `src/app/utils/agent-mentions.test.ts`, "mentionedAgentUsername"
(casos acima) e "needsAgentRegistry".

### CA4

**Marca:** teste de integração

**Cenário:** Dado o app real e uma API do chat falsa em `127.0.0.1`, quando `POST /v1/requests`
chega sem a credencial de serviço, então 401 `unauthorized`; com um Agente fora do catálogo, 404
`agent_not_found`; com um Pedido válido para o `assistente`, 202, e logo depois a API falsa recebe
`POST /v1/bot/requests/<id>/reply` com `Authorization: Bearer <CHAT_BOT_TOKEN>` e um `body` não
vazio, escrito pelo modelo real numa sessão do ADK cujo id é o do Pedido e cujo estado traz o
contexto do Pedido (identificador, Conversa, quem pediu e fuso).

**Teste previsto:** integração, `tests/integration/test_request_routes.py`, "responde 401 sem a
credencial", "responde 404 fora do catálogo" e "aceita o Pedido e grava a resposta como reply"
(que também confere a sessão no `session_service` do app).

### CA5

**Marca:** revisão humana

**Cenário:** Quem revisa abre o `compose.yaml` e encontra `CHAT_BOT_TOKEN` com o mesmo valor de
desenvolvimento em `chat-api`, `agents` e `e2e`, e `CHAT_API_URL: http://chat-api:3000` em
`agents`; e encontra as variáveis novas nos `.env.example` da API do chat e do Serviço de agentes.

### CA6

**Marca:** teste HTTP

**Cenário:** Os testes de CA1 e CA2 são os de ponta a ponta da API do chat; os de CA4 são os de
integração do Serviço de agentes, com a API do chat falsa em `127.0.0.1`.

**Teste previsto:** os de CA1, CA2 e CA4.

### CA7

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` conectado e o bot dele criado, e a Ana e o Bruno num Canal em dois
contextos do navegador, quando a Ana envia "@assistente responda só com a palavra olá", então a
Mensagem do Agente (nome "Assistente", AgentTag) aparece para as duas Pessoas sem recarregar, com o
modelo real. Depois, pelo apoio de bot, o teste lê o Pedido que o envio criou e chama a `reply` de
novo com outro texto: recebe a mesma Mensagem, e a tela continua com uma Mensagem do Agente só.

**Teste previsto:** Playwright, `e2e/agentes/resposta-do-agente.spec.ts`, "a resposta do
@assistente chega às duas Pessoas sem recarregar".

## Contrato

### POST /v1/conversations/:id/messages · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Corpo da requisição | `client_id`, `body`, `quoted_message_id?` | mais `agent_username?`: string, o `@usuário` do Agente conectado mencionado, que o BFF preenche |
| Resposta de sucesso | 201 `{ message }` | 201 `{ message, agent_request: { id, kind: "new" \| "continuation", bot_username, parent_request_id: string \| null } \| null }`. O reenvio do mesmo `client_id` devolve o `agent_request` que a Mensagem criou, ou nulo |
| Erros | 400 `validation_failed` (inclusive o `client_id` de outra Conversa), 401 `unauthenticated`, 404 `conversation_not_found` e `quoted_message_not_found` | mais 422 `bot_not_found`: `agent_username` não é o `@usuário` de um bot |

### POST /v1/bot/requests/:id/reply · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Credencial de bot, `Authorization: Bearer <CHAT_BOT_TOKEN>`, conferida em tempo constante por um guard em todo o controller `/v1/bot` |
| Parâmetros de caminho | `id`: o identificador de pedido (UUID); malformado responde como desconhecido |
| Corpo da requisição | `body`: string obrigatória, com as regras do texto da Mensagem (pontas aparadas, não vazio, no máximo o "Tamanho máximo da Mensagem", sem caractere nulo) |
| Resposta de sucesso | 201 `{ message }`, a Mensagem no formato do histórico, com `author.kind` `bot`. A repetição devolve 201 com a Mensagem já gravada, sem gravar nem publicar |
| Erros | 400 `validation_failed`; 401 `invalid_bot_token`; 404 `request_not_found`; 409 `request_closed`; 410 `request_expired` |

A ordem das recusas: credencial, Pedido inexistente, Pedido encerrado, Pedido vencido, corpo. O
corpo é validado pelo `ValidationPipe`, antes do service, então um corpo inválido com a credencial
certa responde 400 mesmo para um Pedido inexistente.

### POST /v1/requests (Serviço de agentes) · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Credencial de serviço (`AGENTS_SERVICE_TOKEN`), pela dependência do router `/v1` |
| Corpo da requisição | `request_id` (UUID), `kind` (`new` \| `continuation`), `parent_request_id` (UUID \| null), `agent` (o `slug`), `conversation_id` (UUID), `message` (`id` UUID, `body` string), `requester` (`id` UUID, `name`, `username`), `mentions` (lista de `{ username, name }`), `time_zone` (string IANA). Todos obrigatórios; `mentions` pode ser vazia |
| Resposta de sucesso | 202, sem corpo |
| Erros | 400 `validation_failed`; 401 `unauthorized`; 404 `agent_not_found` |

O 409 `agent_not_connected` e o 429 `rate_limited` são da F11-T06.

### Server Action de envio (BFF) · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Chama | `POST /v1/conversations/:id/messages` | `GET /v1/agents` do Serviço de agentes, só quando o texto tem `@`; o envio, com `agent_username` quando o texto menciona um Agente conectado; e, com `agent_request` na resposta, `POST /v1/requests`, esperando só o aceite |
| Acrescenta | — | `agent_username`; no Pedido, quem pediu (o autor da Mensagem gravada), `mentions: []` (as Menções com nome entram na F11-T04) e o fuso do cookie |
| Devolve | `SendMessageResult` | o mesmo; o erro do Agente e o encerramento do Pedido na falha são da F11-T06 |

### agent_requests · chat · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | uuid | não | — | UUID v7, o identificador de pedido |
| `conversation_id` | uuid | não | — | FK `conversations`, `ON DELETE CASCADE` |
| `requester_id` | uuid | não | — | FK `people`, `NO ACTION` |
| `bot_id` | uuid | não | — | FK `bots`, `NO ACTION` |
| `trigger_message_id` | uuid | não | — | FK `messages`, `ON DELETE CASCADE`: a Mensagem do Pedido |
| `kind` | text | não | — | `new` ou `continuation` |
| `parent_request_id` | uuid | sim | — | FK `agent_requests`, `NO ACTION`; preenchido na continuação (F11-T07) |
| `status` | text | não | `'open'` | `open`, `failed` ou `cancelled` |
| `expires_at` | timestamptz | não | — | `created_at` mais a "Validade do identificador de pedido" |
| `created_at`, `updated_at` | timestamptz | não | `now()` | — |

- Chave primária: `id`.
- Única: `agent_requests_trigger_message_key` em `trigger_message_id`: uma Mensagem cria no máximo
  um Pedido, e o reenvio o encontra por ela.
- CHECK `agent_requests_kind_check` (`kind IN ('new', 'continuation')`) e
  `agent_requests_status_check` (`status IN ('open', 'failed', 'cancelled')`), declarados na
  entidade e conferidos na migração `…-AddAgentRequests`.

### bot_actions · chat · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `request_id` | uuid | não | — | FK `agent_requests`, `ON DELETE CASCADE` |
| `action_type` | text | não | — | `reply` ou `question` |
| `message_id` | uuid | não | — | FK `messages`, `ON DELETE CASCADE`: a Mensagem que a ação gravou |
| `created_at`, `updated_at` | timestamptz | não | `now()` | — |

- Chave primária: `(request_id, action_type)` (LLD, "Concorrência e idempotência", "Ação de bot").
- CHECK `bot_actions_action_type_check` (`action_type IN ('reply', 'question')`), declarado na
  entidade e conferido na migração `…-AddAgentRequests`.

### message.created · servidor → cliente · sem mudança de forma

A `reply` publica o `message.created` que já existe, com o autor `bot` da F11-T01, aos Membros da
Conversa do Pedido.

## Verificação do contrato

- Envio com `agent_username`, `agent_request` `new` e o Pedido no banco: CA1.
- Reenvio com o mesmo `agent_request`, e a única em `trigger_message_id`: CA1.
- 422 `bot_not_found`: CA1.
- `agent_request` nulo sem `agent_username`: CA1.
- `reply` 201 com o autor `bot`, a repetição e a chave primária de `bot_actions`: CA2.
- 401 `invalid_bot_token`, 404 `request_not_found`, 409 `request_closed`, 410 `request_expired`:
  CA2. O 400 da `reply` usa o DTO do texto da Mensagem, já provado nos testes do envio e da
  edição; não ganha caso.
- `message.created` da Mensagem de bot: CA2 (socket) e CA7 (tela).
- `POST /v1/requests` 202, 401 e 404: CA4. O 400 segue o handler que já existe, provado nas rotas
  da F10; não ganha caso.
- Server Action de envio: CA3 (reconhecimento) e CA7 (o caminho inteiro).
- Os CHECK de `kind`, `status` e `action_type`: nenhum caminho grava valor fora deles, e a
  conferência do fim da tarefa olha a migração; não ganham caso.

## Decisões

- **Módulos da API do chat.** `src/agent-requests/` (entidades `AgentRequest` e `BotAction`, e o
  `AgentRequestsService`, dono do Pedido: criar, travar para uma ação, achar pela Mensagem) e
  `src/bot/` (o `BotTokenGuard`, o `BotController` em `/v1/bot/requests/:id/...` e o
  `BotActionsService`, que orquestra as ações). A `MessagesService` cria o Pedido dentro da
  transação do envio, chamando o `AgentRequestsService` pelo CLS; a gravação da Mensagem de bot e a
  publicação dela ficam na `MessagesService` (`insertBotMessage` e `publishBotMessage`), porque ela
  é dona da Mensagem e da fila de publicação. As F11-T04 a T07 acrescentam as rotas ao mesmo
  controller e os casos ao mesmo `BotActionsService`.
- **Validação do Pedido numa peça só.** `AgentRequestsService.lockForAction(id)` lê o Pedido com
  `FOR UPDATE` e lança, nesta ordem, `RequestNotFoundError` (inexistente ou id malformado),
  `RequestClosedError` (`failed` ou `cancelled`) e `RequestExpiredError` (`expires_at` igual ou
  anterior a agora). Toda ação de bot, inclusive a leitura e o "digitando" das próximas tarefas,
  passa por ela; a trava põe em fila duas ações do mesmo Pedido, e a segunda encontra a
  `bot_actions` já gravada. Encerrado vem antes de vencido porque o encerramento é o estado
  definitivo.
- **A ação idempotente.** `BotActionsService.reply` trava o Pedido, procura `(request_id, 'reply')`
  em `bot_actions` e, se existe, devolve a Mensagem dela, sem publicar; senão grava a Mensagem
  (`author_bot_id` do Pedido, `client_id` novo) e a `bot_actions` na mesma transação e publica
  depois do commit. A publicação é a do envio menos a Atividade: `message.created` e os números de
  Não lidas dos Membros, porque a Mensagem de bot conta como Não lida e nunca gera Notificação
  (spec, "Autor da Mensagem"). A F11-T07 reaproveita o mesmo caminho na `question`.
- **Credencial de bot.** `CHAT_BOT_TOKEN` obrigatória no schema zod da API do chat; o
  `BotTokenGuard` compara os SHA-256 da credencial recebida e da esperada com `timingSafeEqual`,
  para os comprimentos baterem, e lança `InvalidBotTokenError` (`invalid_bot_token`, 401). Nos
  testes, `test/support/test-env.ts` fixa um valor próprio, exportado por
  `test/support/bot-routes.ts`, que também traz os atalhos de bot dos testes.
- **Pedido no envio.** O bot do `agent_username` é procurado antes de gravar: sem bot,
  `BotNotFoundError` (422) e nada é gravado. Com a Mensagem nova, o Pedido `new` nasce na mesma
  transação, com `expires_at` = agora + `AGENT_REQUEST_TTL_MS` (2 min, constante em
  `agent-request-values.ts`). No reenvio do mesmo `client_id`, nenhum Pedido novo: a resposta traz
  o Pedido que a Mensagem criou, achado pela única em `trigger_message_id`. A Pergunta pendente e a
  continuação ficam para a F11-T07, que acrescenta os passos 1 e 2 da spec na mesma transação.
- **`bot_not_found` no BFF.** Se o registro diz que o Agente está conectado mas a API do chat não
  tem o bot dele (o comando `create-bot` não rodou), o BFF reenvia a Mensagem sem
  `agent_username`, com o mesmo `client_id`: a primeira tentativa não gravou nada, e a Mensagem não
  pode deixar de ser enviada por um erro de instalação. A Menção fica como texto comum, como com o
  registro fora.
- **Reconhecimento no BFF.** `mentionedAgentUsername(text, agents)` em `utils/agent-mentions.ts`
  reaproveita o `splitMessageBody` da F10-T09 com os `@usuário` dos Agentes conectados e devolve o
  primeiro segmento de Agente, ou nulo; com `agents` nulo (registro fora), nulo.
  `needsAgentRegistry(text)` diz se o texto tem `@`. A Server Action só chama o `listAgents` quando
  ela diz que sim.
- **Disparo pelo BFF.** `startAgentRequest(payload)` em `services/agents-service.ts`, com o mesmo
  `request` (Bearer e 5 s), devolve `{ kind: "accepted" }` no 202 ou `{ kind: "failure", status }`;
  a Server Action chama e, nesta tarefa, não age na falha: encerrar o Pedido e mostrar o erro do
  Agente são da F11-T06, que lê esse resultado. `sendMessage` de `services/chat-api.ts` passa a
  aceitar `agentUsername` e a devolver `agentRequest` no resultado `ok`, e `bot_not_found` vira
  `{ kind: "bot_not_found" }`. Quem pediu vai do autor da Mensagem gravada; o fuso, do
  `readTimeZone()`; `mentions` vazia até a F11-T04.
- **Rota de Pedido no Serviço de agentes.** `app/agent_requests/routes.py`, com o router `/v1` e a
  credencial de serviço, como o registro. Confere o Agente no catálogo (`agent_not_found`), responde
  202 e agenda a execução com `asyncio.create_task`, guardando a tarefa num conjunto do
  `app.state` até ela terminar, para o coletor de lixo não a cancelar. As conferências de conexão e
  de limite entram antes do 202 na F11-T06.
- **Execução do Pedido.** `app/agent_requests/execution.py`, `run_request(request, deps)`: cria a
  sessão do ADK com `app_name` = slug, `user_id` = id de quem pediu e `session_id` = id do Pedido;
  roda o `Runner(app=<App do agente>)` com `new_message` = o texto da Mensagem e `state_delta` com o
  contexto (`request_id`, `conversation_id`, `requester_id`, `requester_name`,
  `requester_username`, `time_zone`); toma o texto do último evento `is_final_response()` do agente
  e o grava como `reply` pelo cliente da API do chat. **É esse o ponto em que o texto final vira
  `reply`:** a F11-T06 acrescenta ali o "não consegui", o teto e o log, e a F11-T07 o desvio quando
  a `question` já foi gravada e a retomada da sessão do `parent_request_id`. Nesta tarefa, uma
  falha (modelo, API do chat) só vai para o log, sem texto de Mensagem. As chaves do estado ficam
  como constantes em `app/agent_requests/context.py`, para as ferramentas da F11-T04 lerem pelo
  `ToolContext`; o modelo não as vê, porque nenhuma instrução as injeta.
- **App do agente pelo slug.** `importlib.import_module(f"app.agents.{slug}.agent").app`, cacheado
  por slug: o catálogo já garante a pasta, e o `App` traz o nome que o ADK usa nas sessões.
- **Serviço de sessões pela configuração.** `services.build_session_service(uri)` monta o
  `DatabaseSessionService` com a `SESSION_SERVICE_URI` da `Settings`, ou o de memória sem ela; o
  `get_session_service()` das rotas genéricas passa a usá-la. O `create_app` dá à rota de Pedido o
  da `Settings`, e os testes de integração, sem a variável, rodam em memória, sem tocar o banco de
  desenvolvimento.
- **Cliente da API do chat.** `app/chat_api.py`, `ChatApiClient(base_url, token)`, com um
  `httpx.AsyncClient` criado no `create_app` e fechado no `lifespan`, `Authorization: Bearer
  <CHAT_BOT_TOKEN>` e tempo limite de 10 s. Nesta tarefa, `reply(request_id, body)`, que lança
  `ChatApiError` em resposta fora de 2xx; a F11-T04 acrescenta a leitura, a T05 o "digitando" e a
  T07 a `question` e as contagens, no mesmo cliente. `CHAT_API_URL` e `CHAT_BOT_TOKEN` entram na
  `Settings` como obrigatórias.
- **Instrução mínima.** O `assistente` passa a ter uma instrução curta em português, que responde
  ao pedido em poucas frases e sem `@usuário`. As ferramentas de exemplo e o evalset ficam como
  estão: saem na F11-T04 (CA4 e CA6 dela).
- **Teste de integração com a API falsa.** Um `ThreadingHTTPServer` da biblioteca padrão em
  `127.0.0.1`, numa porta livre, que guarda cada requisição (caminho, cabeçalhos e corpo) e responde
  201. A fixture monta o app com `CHAT_API_URL` apontando para ele; o teste espera a `reply` com
  tempo limite generoso, porque o modelo é real.
- **Apoio de Playwright para agir como bot.** `e2e/support/bot.ts`: `ensureAssistantBot()` cria o
  bot `assistente` direto no banco se ele não existe; `agentRequestOf(channel)` espera e devolve o
  Pedido mais recente da Conversa (`id`, `status`, `kind`) direto do banco; `botReply(requestId,
  body)` chama a rota `/v1/bot` em `localhost:3001` com `CHAT_BOT_TOKEN`, que o serviço `e2e` passa a
  receber. As F11-T04 a T07 acrescentam ali `botTyping` e `botQuestion`. Num teste sem o modelo, o
  bot do teste responde antes do modelo, e a resposta do modelo depois é a repetição, sem nova
  Mensagem (bot_actions).
- **Estado dos Agentes no Playwright.** O teste segura o `agentsLock`, conecta o `assistente` e, no
  fim, devolve o estado que achou.

## Arquivos e interfaces

- `apps/chat-api/src/config/env.schema.ts`: `CHAT_BOT_TOKEN`.
- `apps/chat-api/src/common/errors/error-code.ts` e `problem-details.filter.ts`: `bot_not_found`
  (422), `invalid_bot_token` (401), `request_not_found` (404), `request_closed` (409) e
  `request_expired` (410).
- `apps/chat-api/src/agent-requests/`: novo, `agent-request.entity.ts`, `bot-action.entity.ts`,
  `agent-request-values.ts`, `agent-requests.module.ts`, `agent-requests.service.ts`
  (`openNew`, `findByTriggerMessage`, `lockForAction`, `findAction`, `recordAction`) e os erros.
- `apps/chat-api/src/bot/`: novo, `bot.module.ts`, `bot-token.guard.ts`,
  `invalid-bot-token.error.ts`, `bot.controller.ts` (`POST requests/:id/reply`),
  `bot-actions.service.ts` (`reply`) e `reply.dto.ts`.
- `apps/chat-api/src/bots/bot-not-found.error.ts`: novo.
- `apps/chat-api/src/messages/messages.service.ts`: `sendMessage` devolve `{ message,
  agentRequest }` e recebe `agentUsername`; `insertBotMessage`, `publishBotMessage` e `viewById`.
- `apps/chat-api/src/messages/messages.controller.ts`, `send-message.dto.ts`,
  `messages.module.ts`; `src/app.module.ts`.
- `apps/chat-api/migrations/1794460000000-AddAgentRequests.ts`: nova, gerada e renomeada para
  depois da última.
- `apps/chat-api/test/support/bot-routes.ts`, `test-env.ts`; os testes de CA1 e CA2.
- `apps/chat-api/.env.example`: `CHAT_BOT_TOKEN`.
- `apps/agents/app/config.py`: `chat_api_url` e `chat_bot_token` na `Settings`.
- `apps/agents/app/chat_api.py`: novo, `ChatApiClient`, `ChatApiError`.
- `apps/agents/app/agent_requests/`: novo, `routes.py` (`build_router(catalog)`), `models.py`
  (os modelos do corpo), `context.py` e `execution.py` (`run_request`).
- `apps/agents/app/app_utils/services.py`: `build_session_service(uri)`.
- `apps/agents/app/fast_api_app.py`: o cliente, o serviço de sessões, as tarefas e o router novo.
- `apps/agents/app/agents/assistente/agent.py`: a instrução.
- `apps/agents/tests/integration/conftest.py` e `test_request_routes.py`.
- `apps/agents/.env.example`: as duas variáveis, com o comentário de que vêm do compose.
- `apps/web/src/app/utils/agent-mentions.ts` e `.test.ts`: `mentionedAgentUsername`,
  `needsAgentRegistry`.
- `apps/web/src/app/services/chat-api.ts`: `sendMessage` com `agentUsername`, `agentRequest` e
  `bot_not_found`.
- `apps/web/src/app/services/agents-service.ts`: `startAgentRequest`.
- `apps/web/src/app/actions/send-message.ts`: a orquestração.
- `apps/web/e2e/support/bot.ts`, `e2e/agentes/resposta-do-agente.spec.ts` e o
  `e2e/plano-de-testes-f11.md`.
- `compose.yaml`: as variáveis de CA5.

## Testes existentes que mudam

- `apps/chat-api/test/startup.e2e-spec.ts`: o parametrizado ganha `CHAT_BOT_TOKEN`.
- `apps/agents/tests/integration/conftest.py`: `settings_for` passa `chat_api_url` e
  `chat_bot_token`, obrigatórias na `Settings`.
- `apps/agents/tests/unit/test_config.py`: as obrigatórias da `Settings` ganham as duas variáveis,
  se o teste as listar.

## Mudança de dados

Nenhuma além da migração: as tabelas nascem vazias.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra a credencial de bot, as tabelas, as rotas, a ação de
bot, as variáveis e a regra do Pedido como `planejados` (spec da F11). No fim da tarefa, o que ela
entrega passa a `existe`: a credencial de bot, `reply`, as tabelas, a rota de `reply`, a de Pedido e
as variáveis; o envio com `agent_username`, só no Pedido `new`.
