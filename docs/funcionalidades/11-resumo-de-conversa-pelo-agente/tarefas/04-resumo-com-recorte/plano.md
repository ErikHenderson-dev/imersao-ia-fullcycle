# Plano da F11-T04: Resumo com Recorte de tempo, por Pessoa e por assunto

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas, seção "Conversa") e encontra,
antes do commit de código desta tarefa, os frames `Conversa / Mensagem / Resumo do agente` (que já
existia, só no tema claro), `Conversa / Mensagem / Resumo do agente com aviso de teto` e
`Conversa / Mensagem / Recusa do agente`, cada um também na versão `(escuro)`, montados com instâncias do MessageItem de Agente e do AgentText e com as
variables `Semantic`: o resumo com o cabeçalho, a linha do Recorte com a quantidade de Mensagens e a
lista de pontos com o nome em negrito; o aviso de teto ("cobri as 500 mais recentes, de N"); e a
recusa curta num parágrafo só.

### CA2

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open` numa Conversa com Mensagens de duas Pessoas em instantes
conhecidos, uma Mensagem apagada e uma Mensagem de bot, quando o bot chama
`GET /v1/bot/requests/:id/messages` com a credencial de bot, então recebe 200 com as Mensagens de
Pessoas não apagadas, da mais antiga para a mais nova, cada uma com `id`, `author` (`name`,
`username`), `body` e `created_at`, e o `total`. Com `since`, só as de `since` em diante; com
`until`, só as anteriores a `until`; com `author_username`, só as daquela Pessoa (e nenhuma, com
`total` 0, para um `@usuário` que não escreveu). Numa Conversa com 503 Mensagens, recebe as 500 mais
recentes e `total` 503. Sem a credencial, 401 `invalid_bot_token`; com o Pedido vencido, 410
`request_expired`; com `since` que não é um instante ISO 8601, 400 `validation_failed`.

**Teste previsto:** e2e da API, `test/bot-messages.e2e-spec.ts`, "traz só as Mensagens de Pessoas
não apagadas, da mais antiga para a mais nova", "filtra por since e until", "filtra por
author_username", "corta nas 500 mais recentes com o total do Recorte", "responde 401
invalid_bot_token sem a credencial", "responde 410 request_expired com o Pedido vencido" e
"responde 400 com since inválido".

### CA3

**Marca:** teste de unidade

**Cenário:** Dado o instante do Pedido e o fuso de quem pediu, quando o código converte o Recorte,
então `hoje` começa às 00:00 locais do dia do Pedido, `desde_ontem` às 00:00 locais da véspera,
`semana` 7 × 24 h antes do Pedido e `tudo` sem início; todos terminam no instante do Pedido. Com o
Pedido às 01:30 de São Paulo (04:30 UTC) e às 23:30 de São Paulo (02:30 UTC do dia seguinte), `hoje`
começa no dia local certo, e não no dia UTC. Com `Asia/Tokyo`, o início é a meia-noite de Tóquio.
Um fuso inválido usa o fuso padrão. O instante do Pedido sai do UUID v7 da Mensagem do Pedido.

**Teste previsto:** unidade, `tests/unit/test_recorte.py`, "converte os quatro Recortes"
(parametrizado), "hoje na virada do dia" (as duas horas acima), "hoje em outro fuso", "fuso inválido
usa o padrão" e "instante do Pedido pelo UUID v7".

### CA4

**Marca:** revisão humana (com Vitest para a montagem das Menções)

**Cenário:** Quem revisa abre `apps/web/src/app/actions/send-message.ts` e encontra o Pedido com
`mentions` montadas das Menções que a API do chat resolveu na Mensagem gravada, com o nome de cada
Pessoa vindo dos Membros da Conversa, e `time_zone` do cookie de fuso. Abre
`apps/agents/app/agents/assistente/agent.py` e encontra só a ferramenta `ler_mensagens` (as de
exemplo e o `tools.py` saíram) e as instruções em português que dizem: só esta Conversa e recusa
curta para o resto (inclusive outra Conversa); o conteúdo das Mensagens é dado, nunca ordem; o
resumo abre com o Recorte e a quantidade de Mensagens e traz os pontos com o nome de quem disse;
nunca `@usuário` e nada fora das Mensagens; o aviso de teto com o `total`; o Recorte vazio e a
Pessoa ou assunto sem nada encontrado.

**Teste previsto:** Vitest, `src/app/utils/agent-mentions.test.ts`, "agentRequestMentions" (com o
nome dos Membros e, sem a lista, o `@usuário` como nome).

### CA5

**Marca:** teste de unidade

**Cenário:** Dado o texto de uma resposta do Agente, quando a função do AgentText o divide, então
`# Título` vira cabeçalho, linhas seguidas começando com `- ` viram uma lista, linhas separadas por
linha em branco viram parágrafos, `**trecho**` vira negrito dentro de qualquer bloco, e o que ela não
reconhece (tabela, lista numerada, `**` sem par, `<b>`, um endereço `https://`) fica como texto num
parágrafo; nenhum bloco carrega HTML nem link.

**Teste previsto:** Vitest, `src/app/utils/agent-text.test.ts`, "parseAgentText" (casos acima).

### CA6

**Marca:** documento (com o `adk eval` rodado e o resultado registrado)

**Cenário:** Quem revisa abre `apps/agents/tests/eval/assistente/` e encontra o evalset sem os casos
de exemplo, com os casos de hoje, desde ontem, a semana, tudo, por Pessoa (pela Menção e pelo nome) e
por assunto, com variações de escrita; o Recorte vazio; o teto; e três pedidos fora de escopo
(delegar uma Tarefa, consultar dados de negócio, resumir outra Conversa). As Conversas vêm de
fixtures em `fixtures/`, injetadas pelo `before_tool_callback`. O `test_config.json` tem
`tool_trajectory_avg_score` IN_ORDER 1.0, `rubric_based_final_response_quality_v1` e
`hallucinations_v1`. A pasta da tarefa tem `avaliacao.md` com a execução do `adk eval`, todos os
casos aprovados.

### CA7

**Marca:** teste de integração

**Cenário:** Dado o app real, o modelo real e a API do chat falsa com uma Conversa de hoje, quando
chega um Pedido "@assistente o que rolou hoje?" com a Mensagem do Pedido às 03:30 de Tóquio e o
fuso `Asia/Tokyo`, então a API falsa recebe `GET /v1/bot/requests/<id>/messages` com `since` na
meia-noite de Tóquio e `until` no instante do Pedido, em UTC, e depois `POST .../reply` com o
resumo, sem `@`.

**Teste previsto:** integração, `tests/integration/test_request_routes.py`, "um Pedido com Recorte
lê o Recorte certo e grava o resumo".

### CA8

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` conectado e o bot dele criado, e a Ana e o Bruno num Canal em dois
contextos do navegador, quando a Ana envia "@assistente resume hoje" e o bot do teste responde ao
Pedido pelas rotas com um resumo em Markdown (cabeçalho, linha com negrito, lista de pontos e um
endereço `https://`), então as duas Pessoas veem, sem recarregar, a Mensagem do Agente com o
cabeçalho, a lista com um item por ponto, o negrito e o endereço como texto, sem link. E o axe, na
Conversa com esse resumo, nos dois temas, não acha violações. A validação visual em 1440 × 900 contra
os frames de CA1 fica em `validacao-visual.md`, nesta pasta.

**Teste previsto:** Playwright, `e2e/agentes/resumo-do-agente.spec.ts`, "o resumo chega às duas
Pessoas em blocos do AgentText", e `e2e/acessibilidade/resumo-do-agente-sem-violacoes.spec.ts`.

## Contrato

### GET /v1/bot/requests/:id/messages · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Credencial de bot, pelo `BotTokenGuard` do controller `/v1/bot` |
| Parâmetros de caminho | `id`: o identificador de pedido; malformado responde como desconhecido |
| Query | `since?`: instante ISO 8601, inclusivo; `until?`: instante ISO 8601, exclusivo; `author_username?`: o `@usuário` de uma Pessoa, sem o `@` |
| Resposta de sucesso | 200 `{ messages: [{ id, author: { name, username }, body, created_at }], total }`: as Mensagens de Pessoas, não apagadas, da Conversa do Pedido, no intervalo e da Pessoa pedidos, da mais antiga para a mais nova, no máximo as 500 mais recentes ("Teto de Mensagens do resumo"); `total` conta o Recorte inteiro |
| Erros | 400 `validation_failed`; 401 `invalid_bot_token`; 404 `request_not_found`; 409 `request_closed`; 410 `request_expired` |

`since` e `until` comparam pelo instante do UUID v7 do `id` (o índice `(conversation_id, id)`), com
o mesmo instante que o `created_at`. O Serviço de agentes passa como `until` o instante da Mensagem
do Pedido, e por isso o próprio pedido fica fora do Recorte (PRD, "Regras").

### POST /v1/requests (Serviço de agentes) · sem mudança de forma

O corpo já traz `mentions` e `time_zone` (F11-T03). O BFF passa a preencher `mentions` com
`{ username, name }` de cada Pessoa que a API do chat resolveu na Mensagem.

## Verificação do contrato

- `GET /v1/bot/requests/:id/messages` 200, com o filtro de Pessoas e apagadas, a ordem, `since`,
  `until`, `author_username`, o corte e o `total`: CA2.
- 401, 410 e 400: CA2. O 404 e o 409 vêm do `lockForAction`, já provados na `reply` (F11-T03, CA2);
  não ganham caso.
- `mentions` preenchidas no `POST /v1/requests`: CA4.

## Decisões

- **Leitura na API do chat.** `BotController` ganha `GET messages`, que chama
  `BotActionsService.readMessages(requestId, filter)`: numa transação, `lockForAction` (a mesma
  validação das ações, como a T03 decidiu) e `MessagesService.listForBot(conversationId, filter)`,
  dona da Mensagem. A consulta usa SQL com `JOIN people` (o autor e o filtro por `@usuário`), duas
  vezes: `count(*)` do Recorte e as 500 mais recentes por `id DESC`, invertidas. Os limites viram
  UUIDs v7 de limite (`<instante em hex>-0000-0000-0000-000000000000`), para usar o índice
  `(conversation_id, id)`, como a spec manda. O teto é a constante `SUMMARY_MESSAGE_LIMIT` (500) em
  `src/bot/bot-values.ts`. A validação da query é um DTO (`IsISO8601` com `strict`, `IsString`).
- **`until` exclusivo, e o pedido fora.** A spec deixa o próprio pedido fora do resumo (PRD). Em vez
  de a API conhecer a Mensagem do Pedido, o Serviço de agentes manda `until` = instante da Mensagem
  do Pedido, e a rota trata `until` como exclusivo: Mensagens escritas depois do pedido também ficam
  fora, e a contagem bate com o que o Agente leu. A T07 consome o mesmo `until` na continuação.
- **Instante do Pedido.** `execution.request_state` acrescenta ao estado `requested_at` (ISO UTC),
  tirado do UUID v7 da Mensagem do Pedido (`app/agent_requests/recorte.py`, `uuid7_instant`), e
  `mentions` (a lista `{username, name}`). O Recorte é calculado contra esse instante, e não contra a
  hora em que a ferramenta roda, para a resposta, a avaliação e a contagem da T07 falarem do mesmo
  momento.
- **Conversão do Recorte em UTC (dono: esta tarefa; consumida por T07 e T08).**
  `app/agent_requests/recorte.py`: `Recorte = Literal["hoje", "desde_ontem", "semana", "tudo"]`,
  `recorte_interval(recorte, time_zone, requested_at) -> Interval(since: datetime | None, until:
  datetime)`, função pura com `zoneinfo`; um fuso inválido usa `DEFAULT_TIME_ZONE`
  (`America/Sao_Paulo`, o fuso padrão do LLD); e `to_api_instant(dt)` formata em ISO UTC com `Z`. A
  `perguntar_recorte` da T07 chama `recorte_interval` para os quatro Recortes.
- **Cliente da API do chat.** `ChatApiClient.read_messages(request_id, since, until,
  author_username) -> dict`, com `ChatApiError` fora de 2xx, como a `reply`.
- **Como a ferramenta chega ao cliente.** O cliente nasce no `create_app`, e as ferramentas vivem no
  módulo do agente, importado antes. `run_request` define um `ContextVar` (`app/chat_api.py`,
  `CURRENT_CHAT_API`) antes de rodar o Runner, e a ferramenta, assíncrona, o lê: a tarefa do Pedido
  copia o contexto, e cada app de teste tem o próprio cliente. Fora de um Pedido (playground, `adk
  run`), a ferramenta devolve um erro ao modelo em vez de quebrar.
- **Ferramenta `ler_mensagens(recorte, pessoa=None)`.** Em `app/agents/assistente/tools.py`, async,
  com `ToolContext`. Lê do estado o Pedido, o fuso e o `requested_at`; tira um `@` do começo de
  `pessoa`; chama a leitura por uma "fonte" (`MessageSource`, um `Protocol`: a do cliente da API, em
  produção, e a da fixture, na avaliação); e devolve `{recorte, pessoa, total, cobertas, mensagens:
  [{autor, texto, quando}]}`, com `quando` na hora local de quem pediu (`dd/mm HH:MM`). `cobertas`
  e `total` são números do código: o modelo só os copia no texto e no aviso de teto. Um Recorte fora
  dos quatro devolve `{erro}`.
- **Pessoa pelo nome.** `pessoa` só vale com a Menção (`@usuário`) no pedido. Pelo nome, as
  instruções mandam ler o Recorte sem `pessoa` e ficar com as Mensagens daquele autor, como no
  assunto: o modelo não adivinha um `@usuário`.
- **Sem período.** Por Pessoa e por assunto sem período usam `tudo` (PRD). Um pedido de resumo sem
  Recorte nenhum recebe, nesta tarefa, uma pergunta em texto pelo período; a T07 troca isso pela
  `perguntar_recorte` com as Respostas prontas.
- **Instruções do `assistente` (dono: esta tarefa; consumidas por T07 e T08).** Um
  `InstructionProvider` (`build_instruction(context)` em `app/agents/assistente/instructions.py`):
  o texto fixo, em português, com as regras da spec, e no fim a lista das Pessoas mencionadas no
  pedido (`@usuário` e nome), lida de `mentions` no estado. A função dispensa a injeção `{chave}` do
  ADK, então chaves no texto não viram estado, e o modelo não vê o resto do contexto. A T07
  acrescenta à mesma função as regras da pergunta e da continuação.
- **Menções no BFF.** Com `message.mentions` não vazia na Mensagem gravada, a Server Action lê os
  Membros da Conversa (`listMembers`) e monta `{username, name}` de cada uma
  (`agentRequestMentions(mentions, members)` em `utils/agent-mentions.ts`); sem a lista (falha da
  leitura), o `@usuário` vai como nome, e o Pedido segue. Sem Menção, nenhuma leitura a mais. Mudar
  o payload da Menção na API do chat (`name`) mexeria no `chat-events` e em todas as telas para um
  dado que só o Pedido usa.
- **Mecanismo de fixtures do evalset (dono: esta tarefa; consumido por T07 e T08).**
  `app/eval_fixtures.py`, `fixture_tool_callback` (o `before_tool_callback` do `assistente`). Ele só
  age quando o estado da sessão tem `eval_fixture` (o nome da Conversa), que só o
  `session_input.state` do evalset preenche: o estado de produção vem do `request_state`, que nunca
  tem essa chave, e o modelo não grava estado. Com ela, carrega
  `tests/eval/<app>/fixtures/<nome>.json` (`{"mensagens": [{autor, usuario, texto, quando}]}`) e
  responde a `ler_mensagens` pela mesma função da ferramenta, com uma fonte que filtra a lista por
  `since`, `until` e `usuario` e corta nas 500 mais recentes, como a rota. Assim a conversão do
  Recorte e o formato da resposta da avaliação são os de produção. Cada caso traz no
  `session_input.state` `eval_fixture`, `time_zone`, `requested_at`, `request_id` e `mentions`. A
  T07 acrescenta a resposta da `perguntar_recorte` (as contagens pela mesma fonte).
- **`test_config` (dono: esta tarefa; consumido por T07 e T08).** `tool_trajectory_avg_score`
  `{threshold: 1.0, match_type: IN_ORDER}`; `rubric_based_final_response_quality_v1` com
  `threshold` 1.0, juiz `gemini-3.8-flash`, `num_samples` 3, e as rubricas gerais "não escreve
  `@usuário`" e "responde em português"; as rubricas próprias de cada caso (abre com o Recorte e a
  quantidade, cada ponto com o nome de quem disse, o aviso de teto com o total, "não há Mensagens",
  a recusa curta) ficam no `rubrics` do caso, com `type` `FINAL_RESPONSE_QUALITY`;
  `hallucinations_v1` com `threshold` 1.0 e o mesmo juiz. O `final_response_match_v2` sai, porque o
  texto do resumo varia. A T08 completa os casos até a meta de ≥ 98%.
- **Fixture do teto.** `fixtures/teto.json`, com 620 Mensagens geradas uma vez por um script de
  uso único (rodado no contêiner, fora do repositório), para o caso do teto ter `total` 620 e
  `cobertas` 500.
- **AgentText no cliente.** `utils/agent-text.ts`, `parseAgentText(text): AgentBlock[]`, função
  pura: `heading` (`#`, `##` ou `###` seguido de espaço), `list` (linhas seguidas com `- `),
  `paragraph` (o resto, agrupado por linha em branco, com as quebras de linha); cada bloco com
  `spans: { text, bold }[]`, o negrito por `**…**` com par. O componente
  `components/agent/agent-text.tsx` renderiza os blocos só como texto do React, com os estilos do
  componente AgentText do Figma, e o MessageItem de bot o usa no lugar do MessageBody: o texto do
  Agente não tem Menção nem link (spec, "Cliente").
- **Playwright sem o modelo, com o Serviço de agentes de pé.** Como na T03: o bot do teste responde
  ao Pedido logo depois do envio, antes do modelo, e a resposta do modelo depois é a repetição, sem
  nova Mensagem.

## Arquivos e interfaces

- `apps/chat-api/src/bot/bot.controller.ts`: `GET requests/:requestId/messages`.
- `apps/chat-api/src/bot/bot-actions.service.ts`: `readMessages(requestId, filter)`.
- `apps/chat-api/src/bot/bot-messages.query.ts`: novo, `BotMessagesQuery` (`since`, `until`,
  `author_username`).
- `apps/chat-api/src/bot/bot-messages.response.ts`: novo, `toBotMessagesResponse`.
- `apps/chat-api/src/bot/bot-values.ts`: novo, `SUMMARY_MESSAGE_LIMIT`.
- `apps/chat-api/src/messages/messages.service.ts`: `listForBot(conversationId, filter, limit) ->
  { messages: BotReadMessage[], total }`.
- `apps/chat-api/test/support/bot-routes.ts`: `readMessages(app, requestId, query, token?)`.
- `apps/chat-api/test/bot-messages.e2e-spec.ts`: novo (CA2).
- `apps/agents/app/agent_requests/recorte.py`: novo (`Recorte`, `Interval`, `recorte_interval`,
  `uuid7_instant`, `to_api_instant`, `DEFAULT_TIME_ZONE`).
- `apps/agents/app/agent_requests/context.py`: `REQUESTED_AT`, `MENTIONS`.
- `apps/agents/app/agent_requests/execution.py`: o estado novo e o `ContextVar` do cliente.
- `apps/agents/app/agent_requests/reading.py`: novo, `MessageSource`, `ChatApiSource`,
  `read_recorte(source, state, recorte, pessoa)`.
- `apps/agents/app/chat_api.py`: `read_messages`, `CURRENT_CHAT_API`.
- `apps/agents/app/eval_fixtures.py`: novo, `fixture_tool_callback`, `FixtureSource`.
- `apps/agents/app/agents/assistente/agent.py`, `tools.py` (só `ler_mensagens`) e
  `instructions.py` (novo).
- `apps/agents/tests/unit/test_recorte.py`: novo (CA3).
- `apps/agents/tests/integration/conftest.py`: a API falsa responde `GET` com uma Conversa
  configurável e guarda a query.
- `apps/agents/tests/integration/test_request_routes.py`: o caso de CA7.
- `apps/agents/tests/eval/assistente/assistente.evalset.json`, `test_config.json` e `fixtures/`.
- `apps/agents/AGENTS.md`, seção "Avaliação": as fixtures e os critérios.
- `apps/web/src/app/utils/agent-mentions.ts` e `.test.ts`: `agentRequestMentions`.
- `apps/web/src/app/actions/send-message.ts`: as Menções do Pedido.
- `apps/web/src/app/utils/agent-text.ts` e `.test.ts`: `parseAgentText`, `AgentBlock`.
- `apps/web/src/app/components/agent/agent-text.tsx`: novo, `AgentText`.
- `apps/web/src/app/components/message/message-item.tsx`: o AgentText na Mensagem de bot.
- `apps/web/e2e/agentes/resumo-do-agente.spec.ts`,
  `e2e/acessibilidade/resumo-do-agente-sem-violacoes.spec.ts` e `e2e/plano-de-testes-f11.md`.
- `docs/funcionalidades/11-resumo-de-conversa-pelo-agente/tarefas/04-resumo-com-recorte/`:
  `avaliacao.md`, `validacao-visual.md` e `capturas/`.

## Testes existentes que mudam

- `apps/agents/tests/integration/test_request_routes.py`, "aceita o Pedido e grava a resposta como
  reply": o pedido de teste deixa de ser "responda só com a palavra olá", que a recusa curta
  atende sem ler, e continua provando o 202 e a `reply`; a API falsa passa a responder à leitura.
- `apps/agents/tests/integration/test_agent.py`: pergunta "Why is the sky blue?" a um agente que
  agora recusa; continua passando (o teste só confere que há texto).
- `apps/web/e2e/agentes/resposta-do-agente.spec.ts`: "responda só com a palavra olá" passa a
  receber a recusa curta, que continua sendo uma Mensagem do Agente; o teste segue igual.
- `apps/web/e2e/agentes/mensagem-do-agente.spec.ts` e
  `e2e/acessibilidade/mensagem-do-agente-sem-violacoes.spec.ts`: o texto do bot passa pelo AgentText
  (um parágrafo), sem mudança visível.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra a rota de leitura, o teto e o AgentText como
`planejados` (spec da F11). No fim da tarefa: a leitura passa a `existe` (a contagem segue
`planejada`), e o AgentText também, em "Cliente".
