# Plano da F11-T06: Falhas, limite de pedidos e teto de custo

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre o arquivo `slack` do Figma, página Telas, seção "Conversa", e encontra,
antes do commit de código desta tarefa, os frames `Conversa / Mensagem / Agente não conseguiu`,
`Conversa / Mensagem / Erro do agente: não recebeu` e `Conversa / Mensagem / Erro do agente: limite
de pedidos`, cada um também na versão `(escuro)`, montados com instâncias do MessageItem e do
AgentText e com as variables `Semantic`: a Mensagem do Agente com o texto fixo do "não consegui"
num parágrafo só; e, abaixo da Mensagem enviada por quem pediu, a linha do erro com o ícone
`circle-alert` e o texto de `unavailable` ("O Assistente não recebeu o pedido. Mencione de novo.") ou
de `rate_limited` ("Muitos pedidos em pouco tempo. Tente de novo em um minuto."), em `text/danger-fg`
e `small`, sem botões. As capturas ficam em `capturas/figma-*.png`.

### CA2

**Marca:** teste de integração

**Cenário:** Dado o app real com o `assistente` conectado e o Redis de testes, quando a mesma Pessoa
entrega 10 Pedidos no minuto, então os 10 recebem 202; o 11º recebe 429 `rate_limited`, e o log tem
um `warn` com o identificador do Pedido e sem o texto da Mensagem. Dado o `assistente`
desconectado, quando chega um Pedido para ele, então recebe 409 `agent_not_connected` e a API do chat
falsa não recebe nada. Dado o Redis fora (endereço sem ninguém escutando), quando chega um Pedido,
então recebe 503 `agents_unavailable`. Sem `REDIS_URL`, a configuração falha com o nome da variável.

**Teste previsto:** integração, `tests/integration/test_request_routes.py`, "responde 429 no 11º
Pedido da mesma Pessoa no minuto", "responde 409 com o Agente desconectado" e "responde 503 com o
Redis fora"; unidade, `tests/unit/test_config.py`, a obrigatória `REDIS_URL` no caso que já lista as
obrigatórias.

### CA3

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open` criado pelo envio da Ana, quando ela chama
`POST /v1/agent-requests/:id/close` com `{ "status": "failed" }`, então recebe 204 e o Pedido fica
`failed`; com `cancelled`, fica `cancelled`. Quando encerra de novo um Pedido já `failed`, com
`cancelled`, então recebe 204 e ele continua `failed`. Quando o Bruno, outra Pessoa, encerra o Pedido
da Ana, então recebe 404 `request_not_found` e o Pedido continua `open`; um id malformado ou
desconhecido também recebe 404. Sem Sessão, 401 `unauthenticated`; com `status` fora dos dois, 400
`validation_failed`. Depois do encerramento, a `reply` do bot recebe 409 `request_closed`.

**Teste previsto:** e2e da API, `test/agent-requests-close.e2e-spec.ts`, "encerra o Pedido de quem
pediu" (parametrizado: `failed` e `cancelled`), "encerrar de novo responde 204 sem mudar nada",
"responde 404 request_not_found para o Pedido de outra Pessoa" (parametrizado com o id desconhecido
e o malformado), "responde 401 sem Sessão", "responde 400 com status inválido" e "depois do
encerramento, a reply recebe request_closed".

### CA4

**Marca:** teste no Playwright

**Cenário:** Os quatro desfechos do disparo passam pela mesma decisão do BFF. Dado o `assistente`
conectado, quando a Ana o menciona e o Serviço de agentes recusa o Pedido com 503 (o Redis do limite
indisponível para ela), então a Mensagem fica gravada, o Pedido fica `failed` e a Ana vê, ao lado
da Mensagem, "O Assistente não recebeu o pedido. Mencione de novo."; quando a Ana já fez 10 Pedidos no
minuto, então o 11º fica `failed` e ela vê "Muitos pedidos em pouco tempo. Tente de novo em um
minuto.". O 409 (`cancelled`, sem erro) e a rede fora ou o tempo esgotado (`failed`,
`unavailable`) seguem o mesmo mapeamento, provado em unidade.

**Teste previsto:** Playwright, `e2e/agentes/erro-do-agente.spec.ts` (os dois casos de CA8); Vitest,
`src/app/utils/agent-request-failure.test.ts`, "agentRequestFailure" (sem resposta, 404, 409, 429,
500, 503).

### CA5

**Marca:** teste de integração

**Cenário:** Dado um Pedido aceito e a API do chat falsa, quando a leitura do Recorte responde 500,
então a API falsa recebe uma `reply` com o texto fixo do "não consegui". Quando o teto de chamadas é
atingido (a execução com `max_llm_calls` 1, em que a chamada da ferramenta já gasta a única
chamada), então também grava o "não consegui". Quando a API do chat recusa a resposta com 400 (um
texto acima do tamanho máximo), então o Pedido grava o "não consegui" numa segunda `reply`; com 410
ou 409, não tenta de novo. Em todo Pedido, a execução usa `max_llm_calls` 4 e o `assistente`, o
`max_output_tokens` 1024.

**Teste previsto:** integração, `tests/integration/test_request_failures.py`, "a leitura que falha
grava o não consegui", "o teto de chamadas grava o não consegui", "a resposta recusada com 400 vira
o não consegui" e "a resposta recusada com 410 não tenta de novo"; unidade,
`tests/unit/test_cost_cap.py`, "o Pedido roda com o teto de chamadas e o de tokens de saída".

### CA6

**Marca:** teste de integração

**Cenário:** Dado um Pedido que termina com a resposta, então o log tem um único registro `info` do
fim do Pedido com o identificador, o desfecho `reply`, o tempo em milissegundos e os tokens de
entrada e de saída maiores que zero, e nenhum registro do processo contém o texto da Mensagem do
Pedido nem o da resposta. No Pedido do "não consegui", o desfecho é `failed`. O `warn` do limite está
em CA2.

**Teste previsto:** integração, `tests/integration/test_request_routes.py`, "aceita o Pedido e grava
a resposta como reply" (passa a conferir o registro) e `test_request_failures.py`, "a leitura que
falha grava o não consegui" (o desfecho `failed`).

### CA7

**Marca:** teste HTTP

**Cenário:** Os testes de CA2 e CA5 são os de integração do Serviço de agentes, com a API do chat
falsa em `127.0.0.1`; os de CA3 são os de ponta a ponta da API do chat.

**Teste previsto:** os de CA2, CA3 e CA5.

### CA8

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` conectado, a Ana e o Bruno num Canal, em dois contextos do
navegador: quando o Serviço de agentes recusa o Pedido da Ana (503), então a Ana vê o erro de
`unavailable` ao lado da própria Mensagem, o Bruno vê a Mensagem sem erro nenhum, e o Pedido fica
`failed`; com o limite atingido, a Ana vê o erro de `rate_limited`. Dado um Pedido criado pela rota
de envio, quando o bot do teste grava pela `reply` o texto fixo do "não consegui", então ele aparece
como Mensagem do Agente para as duas Pessoas. A validação visual dos três estados, nos dois temas,
fica em `validacao-visual.md` e `capturas/`.

**Teste previsto:** Playwright, `e2e/agentes/erro-do-agente.spec.ts`, "o erro do Agente aparece só
para quem pediu e o Pedido fica failed", "passar do limite mostra o erro de limite a quem pediu" e
"o não consegui do Agente aparece para as duas Pessoas".

## Contrato

### POST /v1/agent-requests/:id/close (API do chat) · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Sessão (cookie repassado pelo BFF), pelo `AuthGuard` |
| Parâmetros de caminho | `id`: o identificador de pedido (UUID); malformado responde como desconhecido |
| Corpo da requisição | `status`: `"failed"` ou `"cancelled"`, obrigatório |
| Resposta de sucesso | 204, sem corpo. O Pedido já encerrado responde 204 sem mudar o status |
| Erros | 400 `validation_failed`; 401 `unauthenticated`; 404 `request_not_found` (inexistente, malformado ou de outra Pessoa) |

### POST /v1/requests (Serviço de agentes) · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Erros | 400 `validation_failed`; 401 `unauthorized`; 404 `agent_not_found` | mais 409 `agent_not_connected`, 429 `rate_limited` e 503 `agents_unavailable` (Redis fora), conferidos nesta ordem depois do 404 |

### Server Action de envio (BFF) · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Chama | ... e `POST /v1/requests` | mais `POST /v1/agent-requests/:id/close` da API do chat quando o Pedido não é aceito: `cancelled` no 409, `failed` em qualquer outra falha |
| Devolve | `{ kind: "ok", message, agentRequest }` | mais `agentError: { reason: "unavailable" \| "rate_limited", agentName } \| null`: `rate_limited` no 429, `unavailable` na rede fora, no tempo esgotado e em qualquer outra resposta que não 202 nem 409 |

O contrato das tabelas não muda: `agent_requests.status` já aceita `failed` e `cancelled`.

## Verificação do contrato

- `close` 204 com `failed` e `cancelled`, 204 repetido, 404 de outra Pessoa, do desconhecido e do
  malformado, 401, 400: CA3.
- `reply` com `request_closed` depois do encerramento: CA3.
- `POST /v1/requests` 409, 429 e 503: CA2.
- Server Action: o mapeamento das falhas, CA4 (Vitest); o caminho inteiro do 503 e do 429, CA8.

## Decisões

- **Encerramento na API do chat.** `AgentRequestsController` (`POST agent-requests/:id/close`,
  `@HttpCode(204)`, `AuthGuard`) chama `AgentRequestsService.close(personId, requestId, status)`:
  um `UPDATE … WHERE id = :id AND requester_id = :person AND status = 'open'`; sem linha afetada,
  procura o Pedido de quem pediu e, se ele não existe, lança `RequestNotFoundError`; se existe,
  já estava encerrado e nada muda. Um `UPDATE` atômico dispensa a trava: o `lockForAction` de uma
  ação concorrente vê o status depois do commit. O DTO `CloseAgentRequestDto` usa `IsIn`. O módulo
  passa a importar o `SessionsModule`, como o de Mensagens.
- **Ordem das conferências na rota de Pedido.** Agente no catálogo (404), conectado pelo registro do
  Banco dos agentes (409) e só então o limite (429): o Pedido recusado por conexão não gasta o limite
  da Pessoa, como a spec ordena.
- **Limite de pedidos.** `app/agent_requests/rate_limit.py`, `RequestRateLimiter(redis, limit)`,
  `allow(person_id) -> bool`: chave `agent_requests:<person_id>:<minuto>` (minuto = segundos da
  época // 60), `INCR` e `EXPIRE 60 NX` numa transação do Redis; nega acima de
  `AGENT_REQUESTS_PER_MINUTE`. Qualquer `RedisError` vira `ProblemError(503, "agents_unavailable")`.
  O cliente é o `redis.asyncio`, criado no `create_app` com `socket_connect_timeout` e
  `socket_timeout` de 1 s (o Redis fora responde rápido com 503, dentro dos 5 s do BFF) e fechado no
  `lifespan`. `REDIS_URL` obrigatória e `AGENT_REQUESTS_PER_MINUTE` com padrão 10 na `Settings`.
- **Testes do limite.** Os testes de integração usam o banco lógico 2 do Redis (`TEST_REDIS_URL`
  no `compose.yaml`), como a API do chat usa o 1; cada teste tem quem pede próprio, então as chaves
  não se cruzam e vencem sozinhas em 60 s. O registro de conexão é o do `agents_test`: os testes de
  Pedido conectam o `assistente` antes (fixture `connected_assistant`).
- **Teto de custo (spec, "Modelo de IA").** `MAX_LLM_CALLS = 4` vai no `RunConfig` que o
  `run_request` passa ao `run_async`. `MAX_OUTPUT_TOKENS = 1024` fica em `app/model.py`, ao lado do
  `build_model()` que todo agente usa, e o `assistente` o aplica pelo `generate_content_config` do
  `Agent`: assim o `adk eval` roda com o mesmo teto da produção. O `RunConfig` entra em
  `ExecutionDeps` com o padrão do teto, para o teste do teto passar um limite menor.
- **Fim do Pedido.** O `run_request` separa produzir o texto de gravá-lo: qualquer exceção ao rodar o
  agente (modelo, `LlmCallsLimitExceededError`, uma ferramenta cuja leitura falhou) ou o texto final
  vazio viram o `reply` fixo `NAO_CONSEGUI` ("Não consegui fazer o resumo agora. Tente de novo em
  instantes."). Na gravação, `ChatApiError` passa a levar o `status`: 404, 409 e 410 são o Pedido
  que não aceita mais nada, e o Pedido termina com um `warn`, sem nova tentativa; qualquer outra
  recusa da resposta do modelo (o 400 de um texto acima do "Tamanho máximo da Mensagem", um 5xx, a
  rede) leva a uma segunda `reply` com o `NAO_CONSEGUI`. Se ela também falha, `error` no log. O
  texto do modelo não é cortado: um resumo cortado no meio seria um resumo errado.
- **Desfechos e níveis do log.** O registro `info` do fim (`pedido_concluido`) traz, em `chave=valor`
  e também em `extra`, `request_id`, `desfecho` (`reply`, `failed` quando gravou o "não consegui",
  `discarded` quando nada foi gravado), `tempo_ms` e `tokens_entrada` e `tokens_saida`, somados do
  `usage_metadata` (`prompt_token_count` e `candidates_token_count`) de cada evento. O teto de
  chamadas gera `warn`; a falha do modelo e a exceção inesperada, `error` com o tipo da exceção,
  sem a mensagem dela (que pode citar texto do modelo); o limite de pedidos, `warn` na rota. O
  logger `app` ganha um handler com nível INFO no `fast_api_app.py`: sem ele, o uvicorn só mostra
  `warning` dos módulos do projeto.
- **Pedido entregue duas vezes.** Resolve a pendência do reenvio do mesmo `client_id`: o BFF
  continua sem saber se o Pedido é novo e o dispara de novo, que é o caminho mais simples; quem
  garante uma execução só é a sessão do ADK, com o id do Pedido. O `create_session` fica fora do
  tratamento do "não consegui": o `AlreadyExistsError` encerra a segunda entrega com `warn` e o
  desfecho `discarded`, sem gravar nada, então ela nunca vira um "não consegui" ao lado da resposta
  da primeira. A continuação da F11-T07 retoma a sessão do Pedido pai e precisa da própria guarda.
- **Falha do disparo no BFF.** Uma função pura, `agentRequestFailure(result)` em
  `utils/agent-request-failure.ts`, decide a partir do `StartAgentRequestResult`: `null` no aceite;
  `{ close: "cancelled", reason: null }` no 409; `{ close: "failed", reason: "rate_limited" }` no
  429; `{ close: "failed", reason: "unavailable" }` no resto. A Server Action encerra o Pedido por
  `closeAgentRequest(token, id, status)` (novo em `services/chat-api.ts`), cuja falha não muda o que
  a tela mostra (o Pedido vence sozinho em 2 min), e devolve `agentError` com o nome do Agente
  mencionado, que ela já tem do registro; sem ele (a continuação da F11-T07), "O Agente".
- **Erro do Agente no cliente.** O `usePendingMessages` passa o `agentError` ao `onSent`; o
  `MessageHistory` guarda os erros num mapa por id de Mensagem, em estado da aba, e o `MessageItem`
  ganha `agentError`, que renderiza `AgentRequestError` abaixo do texto: ícone `CircleAlert`, texto
  em `text-small text-danger-fg`, com `role="alert"`, como o "Não foi possível enviar.". O aviso é só
  da aba que enviou e some ao recarregar: é um aviso para quem acabou de pedir, e não um estado da
  Mensagem (LLD, "Erros"). Os textos ficam no componente.
- **Playwright sem parar o Serviço de agentes.** Com o Serviço de agentes parado, o `GET /v1/agents`
  também falha, e a spec manda enviar a Menção como texto comum, sem Pedido ("Disparo pelo BFF",
  passo 1); por isso o teste faz o Serviço de agentes de pé recusar só o `POST /v1/requests`, o
  mesmo caminho do BFF para qualquer resposta que não 202 nem 409. Pelo Redis de desenvolvimento,
  que o `e2e` já alcança: para o 503, grava na chave do limite da Ana, no minuto atual e no seguinte,
  um valor que o `INCR` recusa; para o 429, grava 10. Cada teste tem a própria Ana, e as chaves
  vencem em 60 s. Nada fica parado, então não há o que subir de volta no fim.
- **"Não consegui" no Playwright.** O teste cria o Pedido pela rota de envio da API do chat (como a
  F11-T05, sem passar pelo BFF) e o bot do teste grava o texto fixo pela `reply`; o texto fica numa
  constante do teste, igual ao `NAO_CONSEGUI` do Serviço de agentes.
- **Efeito no p95.** O teto não muda o Pedido comum, que usa 2 chamadas (a ferramenta e o texto). O
  `max_output_tokens` 1024 limita o tempo de geração do texto final, e nada acrescenta à latência;
  os 6 a 12 s por caso da avaliação da F11-T04 continuam para a medição da F11-T08. Se o modelo
  contar o raciocínio no teto e o texto vier vazio, o teste de integração de CA6 acusa (tokens de
  saída e resposta), e o caso é levado ao usuário antes de mudar o teto.

## Arquivos e interfaces

- `apps/chat-api/src/agent-requests/agent-requests.controller.ts`: novo, `POST
  agent-requests/:id/close`.
- `apps/chat-api/src/agent-requests/close-agent-request.dto.ts`: novo, `status`.
- `apps/chat-api/src/agent-requests/agent-requests.service.ts`: `close(personId, requestId,
  status)`.
- `apps/chat-api/src/agent-requests/agent-requests.module.ts`: o controller e o `SessionsModule`.
- `apps/chat-api/test/support/bot-routes.ts`: `closeRequest(app, cookie, requestId, status)`.
- `apps/chat-api/test/agent-requests-close.e2e-spec.ts`: novo (CA3).
- `apps/agents/pyproject.toml` e `uv.lock`: `redis`.
- `apps/agents/app/config.py`: `redis_url`, `agent_requests_per_minute`.
- `apps/agents/app/agent_requests/rate_limit.py`: novo, `RequestRateLimiter`.
- `apps/agents/app/agent_requests/routes.py`: a conexão e o limite antes do 202; `build_router`
  recebe o limitador.
- `apps/agents/app/agent_requests/execution.py`: `NAO_CONSEGUI`, `MAX_LLM_CALLS`, `RUN_CONFIG`,
  `ExecutionDeps.run_config`, o fim do Pedido e o log.
- `apps/agents/app/chat_api.py`: `ChatApiError.status`.
- `apps/agents/app/model.py`: `MAX_OUTPUT_TOKENS`.
- `apps/agents/app/agents/assistente/agent.py`: `generate_content_config`.
- `apps/agents/app/fast_api_app.py`: o cliente do Redis, o limitador e o logger `app`.
- `apps/agents/tests/integration/conftest.py`: `redis_url` em `settings_for`, a API falsa com status
  configuráveis, `connected_assistant`.
- `apps/agents/tests/integration/test_request_routes.py` e `test_request_failures.py` (novo);
  `tests/unit/test_cost_cap.py` (novo) e `test_config.py`.
- `apps/agents/.env.example`: as duas variáveis, com o comentário de que vêm do compose.
- `compose.yaml`: `REDIS_URL`, `TEST_REDIS_URL` e o `depends_on` do Redis no `agents`.
- `apps/web/src/app/utils/agent-request-failure.ts` e `.test.ts`: `agentRequestFailure`.
- `apps/web/src/app/services/chat-api.ts`: `closeAgentRequest`; `AgentError`; `agentError` no
  `SendMessageResult` `ok`.
- `apps/web/src/app/actions/send-message.ts`: o encerramento e o erro.
- `apps/web/src/app/hooks/use-pending-messages.ts`: `onSent(message, agentError)`.
- `apps/web/src/app/components/conversation/message-history.tsx`: o mapa dos erros.
- `apps/web/src/app/components/message/message-item.tsx`: `agentError`, `AgentRequestError`.
- `apps/web/e2e/support/redis.ts`: `fillAgentRequestLimit(personId)`, `breakAgentRequestLimit(personId)`.
- `apps/web/e2e/agentes/erro-do-agente.spec.ts`: novo; `e2e/plano-de-testes-f11.md`: a seção da
  F11-T06.
- `docs/funcionalidades/11-resumo-de-conversa-pelo-agente/tarefas/06-falhas-limite-e-teto-de-custo/`:
  `validacao-visual.md` e `capturas/`.

## Testes existentes que mudam

- `apps/agents/tests/integration/test_request_routes.py`: os casos que esperam o 202 passam a
  conectar o `assistente` antes, porque a rota confere a conexão; o caso da `reply` passa a conferir o
  registro do fim do Pedido (CA6).
- `apps/agents/tests/integration/conftest.py`: `settings_for` passa `redis_url`, obrigatória.
- `apps/agents/tests/unit/test_config.py`: `REDIS_URL` entre as obrigatórias.

## Mudança de dados

Nenhuma.

## Documentos atualizados

- `docs/lld.md`, seção "Estrutura do código": o cliente do Redis no Serviço de agentes (`redis`,
  `redis.asyncio`), `planejado`.
- `docs/lld.md`, seção "Erros": o aviso de erro do Agente vive só na aba que enviou, até recarregar.
- `docs/lld.md`, seção "Pedido ao agente e Pergunta pendente": o "não consegui" quando a API do chat
  recusa a resposta por formato, nada gravado com o Pedido recusado (404, 409, 410), e a segunda
  entrega do mesmo Pedido sem efeito, `planejados`.
- `docs/lld.md`, seção "Valores e configuração": `TEST_REDIS_URL` do Serviço de agentes,
  `planejada`.
- `docs/lld.md`, seção "Ambiente de desenvolvimento": o banco lógico 2 do Redis é dos testes do
  Serviço de agentes.
