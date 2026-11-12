# Plano da F11-T07: Escolher o Recorte por Resposta pronta ou responder sem Menção

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre o arquivo `slack` do Figma, página Telas, seção "Conversa", e encontra,
antes do commit de código desta tarefa, os frames `Conversa / Mensagem / Pergunta do agente`,
`Conversa / Mensagem / Pergunta do agente para outro Membro` e `Conversa / Mensagem / Pergunta do
agente encerrada`, cada um também na versão `(escuro)`, montados com instâncias do MessageItem de
Agente, do AgentText e do Button `secondary` `sm` (ativo ou `disabled`) e com as variables
`Semantic`: o texto da pergunta num parágrafo do AgentText ("De que período você quer o resumo? Você
pode responder sem me mencionar."); os quatro botões "Hoje (3)", "Desde ontem (5)", "A semana (12)"
e "Tudo (24)" numa linha que quebra; e, abaixo, a linha com o ícone `clock` de 12 px e o texto em
`caption/regular` e `text/fg-muted`: "Aguardando sua resposta" para quem pediu, "Só quem pediu pode
responder" para outro Membro e "Encerrada" depois da resposta ou do vencimento, este com a Mensagem
"Hoje (3)" de quem pediu logo abaixo. Os frames da pergunta já existiam (do desenho de referência,
com "Hoje · 3") e foram alinhados à spec; os escuros são novos. As capturas ficam em
`capturas/figma-*.png`.

### CA2

**Marca:** teste HTTP

**Cenário:** Dado um Pedido `open` numa Conversa com Mensagens de duas Pessoas em instantes
conhecidos, uma apagada e uma de bot, quando o bot chama `GET /v1/bot/requests/:id/message-counts`
com três `since` e um `until`, então recebe 200 com uma contagem por `since`, na ordem pedida, e o
`total` sem início, e cada número é igual ao `total` que a rota de leitura devolve para o mesmo
intervalo. Sem `since`, só o `total`. Com `since` inválido, 400 `validation_failed`; sem a
credencial, 401 `invalid_bot_token`. Quando o bot chama `POST /v1/bot/requests/:id/question` com
`body` e `quick_replies`, então recebe 201 com a Mensagem de bot com `quick_replies { options,
owner_id (quem pediu), expires_at (1 h depois), closed: false }`, e o banco tem a Pergunta pendente
aberta de quem pediu naquela Conversa; repetida, devolve a mesma Mensagem, sem segunda pergunta.
Com uma pergunta aberta de outro Pedido da mesma Pessoa e Conversa, a nova a encerra. Sem
`quick_replies`, com lista vazia ou mais de quatro rótulos, 400 `validation_failed`. Com o servidor
real, a pergunta chega como `message.created` com `quick_replies` e emite o fim do "digitando" do
bot.

**Teste previsto:** e2e da API, `test/bot-question.e2e-spec.ts`, "conta as Mensagens desde cada
since, como a leitura", "sem since, devolve só o total", "responde 400 com since inválido",
"responde 401 sem a credencial", "grava a pergunta e abre a Pergunta pendente de quem pediu",
"repetir devolve a mesma pergunta", "a pergunta nova encerra a anterior" e "responde 400 com
quick_replies inválidas" (parametrizado); `test/realtime-bot.e2e-spec.ts`, "a pergunta do bot
chega com as Respostas prontas e encerra o digitando".

### CA3

**Marca:** teste HTTP

**Cenário:** Dada a Pergunta pendente aberta da Ana, quando ela envia uma Mensagem sem
`agent_username`, então a resposta traz `agent_request` com `kind` `continuation`, o
`bot_username` do bot da pergunta e o `parent_request_id` do Pedido que perguntou, e a pergunta fica
encerrada; o reenvio do mesmo `client_id` devolve o mesmo Pedido. Quando ela envia com
`agent_username`, então a pergunta se encerra e nasce um Pedido `new`. Quando o Bruno, outro Membro,
envia, então `agent_request` é nulo e a pergunta continua aberta. Com a pergunta vencida
(`expires_at` no passado), a Mensagem da Ana sem Menção não cria Pedido. Com a pergunta já encerrada,
a segunda Mensagem da Ana sem Menção não cria Pedido. Quando a Ana envia duas Mensagens ao mesmo
tempo, então só uma delas traz `agent_request`, e o banco tem um Pedido `continuation` só.

**Teste previsto:** e2e da API, `test/pending-questions.e2e-spec.ts`, "a resposta sem Menção vira
continuação e encerra a pergunta", "o reenvio devolve a mesma continuação", "a Menção ao Agente
encerra a pergunta e cria um Pedido new", "a Mensagem de outro Membro não encerra a pergunta", "a
pergunta vencida não vira continuação", "depois de encerrada, a Mensagem sem Menção não chama o
Agente" e "dois envios simultâneos criam um Pedido só".

### CA4

**Marca:** teste HTTP

**Cenário:** Dada a pergunta do bot aberta e a Ana e o Bruno com sockets na Conversa, quando a Ana
responde sem Menção, então os dois recebem `message.updated` da Mensagem da pergunta com
`quick_replies.closed` verdadeiro e as mesmas `options`, `owner_id` e `expires_at`; o histórico
devolve a pergunta com `closed` verdadeiro e as outras Mensagens com `quick_replies` nulo.

**Teste previsto:** e2e da API, `test/realtime-bot.e2e-spec.ts`, "encerrar a pergunta publica
message.updated com closed"; `test/pending-questions.e2e-spec.ts`, "o histórico traz a pergunta
encerrada".

### CA5

**Marca:** teste de integração (com unidade para os rótulos)

**Cenário:** Dado o app real, o modelo real e a API do chat falsa, quando chega um Pedido `new`
"@assistente resume a conversa pra mim", então a API falsa recebe `GET .../message-counts` com os
`since` de hoje, desde ontem e semana e o `until` no instante do Pedido, e depois `POST .../question`
com os rótulos "Hoje (N)", "Desde ontem (N)", "A semana (N)" e "Tudo (N)" das contagens que ela
devolveu, e nenhuma `reply`. Quando chega a continuação "Hoje (4)", com o `parent_request_id` desse
Pedido, então a API falsa recebe a leitura de hoje e a `reply` com o resumo, e a sessão do ADK do
Pedido pai tem os eventos dos dois turnos. Quando chega uma continuação "@ana você viu o deploy?",
então a `reply` é a frase fixa de que não entendeu o Recorte, sem leitura nem nova pergunta. Quando
a mesma continuação é entregue de novo, então a rota responde 202 e nada roda: uma `reply` só.

**Teste previsto:** unidade, `tests/unit/test_question.py`, "os rótulos das Respostas prontas
saem das contagens" e "os intervalos das contagens são os da leitura"; integração,
`tests/integration/test_request_question.py`, "um Pedido sem Recorte grava a pergunta com as
contagens", "a continuação retoma a sessão e grava o resumo", "a continuação que não responde diz
que não entendeu" e "a continuação entregue de novo não roda outra vez".

### CA6

**Marca:** teste de unidade (com revisão humana do componente)

**Cenário:** Dadas as Respostas prontas de uma Mensagem, a Pessoa da Sessão e a hora, quando a função
decide o estado, então é `active` para o dono antes do `expires_at` e com `closed` falso,
`other_member` para outra Pessoa, `closed` com `closed` verdadeiro (para o dono e para os outros) e
`closed` com a hora no `expires_at` ou depois. Quem revisa abre `components/agent/quick-replies.tsx`
e encontra os botões nativos (`<button>`, que disparam com Enter e Espaço) na ordem da Mensagem,
ativos só no estado `active`, que chamam o envio comum com o rótulo; e, no estado `other_member`,
o `aria-label` de cada botão com o rótulo e "só quem pediu pode responder".

**Teste previsto:** Vitest, `src/app/utils/quick-replies.test.ts`, "quickRepliesState" (dono,
outro Membro, encerrada, vencida, vencida no instante exato).

### CA7

**Marca:** documento (com o `adk eval` rodado e o resultado registrado) e teste de integração

**Cenário:** Quem revisa abre `apps/agents/tests/eval/assistente/assistente.evalset.json` e
encontra os casos de vários turnos `pergunta_e_botao` (pedido sem Recorte → `perguntar_recorte`;
"Desde ontem (6)" → `ler_mensagens` com `desde_ontem`), `pergunta_e_resposta_escrita` (→
`perguntar_recorte`; "só de hoje" → `ler_mensagens` com `hoje`) e `resposta_que_nao_responde` (→
`perguntar_recorte`; "@ana você viu o deploy?" → nenhuma ferramenta e a frase de que não entendeu),
com a `perguntar_recorte` respondida pela fixture; e `avaliacao.md` nesta pasta, com a execução do
`adk eval` desses casos, todos aprovados. A mesma sessão nos dois turnos é provada pelo teste de
integração de CA5.

### CA8

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` desconectado (o clique não chama o modelo: o Serviço de agentes
responde 409, e o BFF encerra a continuação sem erro), o bot dele criado, e a Ana e o Bruno num Canal
em dois contextos do navegador: quando a Ana cria um Pedido e o bot do teste grava a pergunta com
as quatro Respostas prontas, então a Ana vê os botões ativos e "Aguardando sua resposta", e o Bruno
os vê desativados, com "Só quem pediu pode responder" e o rótulo acessível que diz que é de quem
pediu. Quando a Ana clica em "Hoje (3)" (pelo teclado, com foco e Enter), então a Mensagem "Hoje
(3)" da Ana aparece para as duas Pessoas, os botões ficam desativados e "Encerrada" para as duas,
sem recarregar, e o Pedido mais novo da Conversa é `continuation`. Dada uma pergunta cujo
`expires_at` está a poucos segundos, quando a Ana abre a Conversa, então vê os botões ativos e,
passado o vencimento, desativados com "Encerrada", sem recarregar. E o axe, na Conversa com a
pergunta ativa para quem pediu, nos dois temas, não acha violações. A validação visual em 1440 × 900
contra os frames de CA1 fica em `validacao-visual.md` e `capturas/`.

**Teste previsto:** Playwright, `e2e/agentes/respostas-prontas.spec.ts`, "os botões valem só para
quem pediu e o clique vira Mensagem" e "a pergunta vencida desativa os botões";
`e2e/acessibilidade/respostas-prontas-sem-violacoes.spec.ts`.

## Contrato

### GET /v1/bot/requests/:id/message-counts · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Credencial de bot, pelo `BotTokenGuard` do controller `/v1/bot` |
| Parâmetros de caminho | `id`: o identificador de pedido; malformado responde como desconhecido |
| Query | `since`: instante ISO 8601 com fuso, repetível (`?since=…&since=…`), de 0 a 10; `until?`: instante ISO 8601 com fuso, exclusivo |
| Resposta de sucesso | 200 `{ counts: [{ since, count }], total }`: para cada `since`, na ordem pedida, as Mensagens de Pessoas não apagadas da Conversa do Pedido de `since` (inclusivo) até `until` (exclusivo); `total` conta o mesmo sem início. `since` volta como foi recebido |
| Erros | 400 `validation_failed`; 401 `invalid_bot_token`; 404 `request_not_found`; 409 `request_closed`; 410 `request_expired` |

### POST /v1/bot/requests/:id/question · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Credencial de bot |
| Parâmetros de caminho | `id`: o identificador de pedido; malformado responde como desconhecido |
| Corpo da requisição | `body`: string obrigatória, com as regras do texto da Mensagem; `quick_replies`: lista obrigatória de 1 a 4 rótulos, cada um string aparada, não vazia, de no máximo 64 caracteres |
| Resposta de sucesso | 201 `{ message }`, a Mensagem de bot no formato do histórico, com `quick_replies` preenchido. A repetição devolve 201 com a Mensagem já gravada, sem gravar nem publicar |
| Erros | 400 `validation_failed`; 401 `invalid_bot_token`; 404 `request_not_found`; 409 `request_closed`; 410 `request_expired` |

### POST /v1/conversations/:id/messages · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Resposta de sucesso | `agent_request` com `kind` `new` só com `agent_username` | Também `kind` `continuation`, com o `bot_username` do bot da pergunta e o `parent_request_id` do Pedido que perguntou, quando a Mensagem nova não tem `agent_username` e quem envia tem Pergunta pendente aberta e não vencida na Conversa |

### Mensagem no REST e nos eventos (`MessagePayload`) · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Campos | `id`, `conversation_id`, `client_id`, `author`, `body`, `created_at`, `edited_at`, `mentions`, `quote` | mais `quick_replies: { options: string[], owner_id: string, expires_at: string, closed: boolean } \| null`, nulo em toda Mensagem que não é pergunta do bot. Vale no histórico, no envio, nas rotas do bot, em `message.created` e em `message.updated`; o evento guardado antes da F11-T07 chega sem o campo, e o cliente o lê como nulo |

### message.updated · servidor → cliente · sem mudança de forma

Publicado também quando a Pergunta pendente se encerra pelo envio, com a Mensagem da pergunta e
`quick_replies.closed` verdadeiro, aos Membros da Conversa, sem mudar `edited_at`.

### POST /v1/requests (Serviço de agentes) · sem mudança de forma

A continuação (`kind` `continuation`, com `parent_request_id`) passa a rodar na sessão do Pedido pai.
A entrega repetida da mesma continuação é aceita com 202 sem rodar, como a do Pedido `new`.

### pending_questions · chat · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | uuid | não | — | UUID v7 |
| `request_id` | uuid | não | — | FK `agent_requests`, `ON DELETE CASCADE`: o Pedido que perguntou |
| `conversation_id` | uuid | não | — | FK `conversations`, `ON DELETE CASCADE` |
| `person_id` | uuid | não | — | FK `people`, `NO ACTION`: quem pediu, o dono da pergunta |
| `bot_id` | uuid | não | — | FK `bots`, `NO ACTION` |
| `question_message_id` | uuid | não | — | FK `messages`, `ON DELETE CASCADE` |
| `expires_at` | timestamptz | não | — | a gravação mais a "Validade da Pergunta pendente" |
| `closed_at` | timestamptz | sim | — | quando se encerrou |
| `created_at`, `updated_at` | timestamptz | não | `now()` | — |

- Chave primária: `id`.
- Única parcial `pending_questions_open_key` em `(conversation_id, person_id)` `WHERE closed_at IS
  NULL`: uma pergunta aberta por Pessoa e Conversa.
- Única `pending_questions_question_message_key` em `question_message_id`: uma pergunta por
  Mensagem, e o índice da leitura do payload.

### messages · chat · alterada

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `quick_replies` | jsonb | sim | — | nova: a lista de rótulos da pergunta do bot; nula nas outras |

### bot_actions · chat · sem mudança

O tipo `question`, já aceito pelo CHECK da F11-T03, passa a ser gravado.

## Verificação do contrato

- `message-counts` 200 com as contagens, o `total` e a igualdade com a leitura, sem `since`, 400 e
  401: CA2. O 404, o 409 e o 410 vêm do `lockForAction`, provados na `reply` (F11-T03); não ganham
  caso.
- `question` 201, a Pergunta pendente aberta, a repetição, a pergunta nova que encerra a anterior e o
  400 das `quick_replies`: CA2. 401, 404, 409 e 410: o mesmo guard e o mesmo `lockForAction`; não
  ganham caso.
- `message.created` da pergunta com `quick_replies` e o fim do "digitando": CA2.
- Envio com `continuation`, o reenvio, o `new` que encerra, outro Membro, vencida, já encerrada e os
  envios simultâneos: CA3.
- `message.updated` com `closed` e o payload no histórico: CA4. O payload no cliente: CA6 e CA8.
- A única parcial de `pending_questions`: CA2 (a nova encerra a anterior, e a gravação não esbarra
  nela) e CA3 (os envios simultâneos). A única em `question_message_id` e as FKs: nenhum caminho grava
  duas perguntas por Mensagem; a conferência do fim da tarefa olha a migração.
- `POST /v1/requests` na continuação, a sessão do pai e a reentrega: CA5.

## Decisões

- **Pergunta pendente no módulo do Pedido.** A entidade `PendingQuestion` e o
  `PendingQuestionsService` ficam em `src/agent-requests/`, ao lado do Pedido, porque a pergunta
  nasce de uma ação dele e o envio já fala com esse módulo. O service tem `open(request,
  questionMessageId)`, que encerra a aberta da mesma Pessoa e Conversa e grava a nova, devolvendo a
  encerrada; `takeOpen(conversationId, personId)`, que lê a aberta com `FOR UPDATE`, grava
  `closed_at` e a devolve (ou nulo); e `viewsByMessages(ids)`, para o payload.
- **Encerrar em toda Mensagem nova de quem pediu.** Na transação do envio, depois de gravar a
  Mensagem nova (o reenvio não muda nada), `takeOpen` trava e encerra a pergunta aberta de quem
  envia, vencida ou não. Sem `agent_username` e com ela não vencida, nasce o Pedido `continuation`
  (bot e `parent_request_id` da pergunta); com `agent_username`, o `new`, como antes. Encerrar a
  vencida não muda o que a tela mostra (o cliente já a desativou pelo `expires_at`) e mantém uma regra
  só: a primeira Mensagem de quem pediu sempre encerra a pergunta (PRD, "Pergunta pendente"). A
  segunda de dois envios simultâneos espera a trava da linha e, relida, não a encontra mais aberta.
- **A continuação no Pedido.** `AgentRequestsService.openContinuation` grava o Pedido com `kind`
  `continuation` e o `parent_request_id`, com a mesma validade do `new`.
- **A publicação do encerramento.** O envio devolve, além da Mensagem, o id da Mensagem da pergunta
  encerrada; depois do commit, a `MessagesService` relê essa Mensagem montada e publica
  `message.updated` aos Membros pela fila dela, como a edição, para sair depois do `message.created`
  da pergunta. A pergunta nova do bot que encerra uma anterior publica o mesmo.
- **As Respostas prontas na Mensagem.** `messages.quick_replies` (jsonb) guarda os rótulos;
  `owner_id`, `expires_at` e `closed` vêm da `pending_questions` da Mensagem, lida numa consulta por
  página no `withDetails`, só para as Mensagens com `quick_replies`. `MessageView` ganha
  `quickReplies`, e o `toMessageResponse` o converte em `quick_replies`.
- **A ação `question`.** `BotActionsService.question(requestId, body, labels)` segue a `reply`: numa
  transação, `lockForAction`, a repetição devolve a Mensagem da `bot_actions`, senão grava a
  Mensagem de bot com `quick_replies`, a ação e a Pergunta pendente de quem pediu
  (`PENDING_QUESTION_TTL_MS`, 1 h, em `agent-request-values.ts`); depois do commit, publica a
  Mensagem, emite o fim do "digitando" (`announceAnswer`, da F11-T05) e publica o encerramento da
  anterior, se houve. O DTO `QuestionDto` estende o da `reply` com `quick_replies` (`ArrayMinSize` 1,
  `ArrayMaxSize` 4, cada um aparado, `IsNotEmpty`, `MaxLength` 64).
- **As contagens.** `MessagesService.countForBot(conversationId, sinces, until)` faz uma consulta
  com `count(*) FILTER (WHERE m.id >= $n)` por `since` e `count(*)` para o `total`, com os mesmos
  filtros e limites UUID v7 da `listForBot`, para os números serem os da leitura.
  `BotActionsService.countMessages` passa pelo `lockForAction`, como a leitura.
- **`until` nas contagens.** A spec lista só `since` na rota, e o CA2 pede contagens iguais às da
  leitura; a leitura do Serviço de agentes usa `until` = instante do Pedido, então a contagem aceita o
  mesmo `until` exclusivo. Sem ele, a contagem iria até agora e poderia contar a própria Mensagem do
  Pedido. Registrado no LLD, "Interfaces".
- **A pergunta no Serviço de agentes.** `app/agent_requests/question.py`: `QUESTION_BODY` ("De que
  período você quer o resumo? Você pode responder sem me mencionar.", o texto do Figma),
  `count_intervals(state)` (os `since` de hoje, desde ontem e semana pela `recorte_interval` da
  F11-T04 e o `until` do Pedido) e `quick_reply_labels(counts, total)` ("Hoje (N)", "Desde ontem
  (N)", "A semana (N)", "Tudo (N)"), com um `MessageCounter` (Protocol) cuja fonte é a API do chat em
  produção e a fixture na avaliação, como a leitura. `ChatApiClient` ganha `message_counts` e
  `question`.
- **Ferramenta `perguntar_recorte()`.** Em `tools.py`, sem argumentos do modelo: conta, grava a
  `question` e devolve `{pergunta, opcoes}`. Ela marca no estado `pergunta_do_pedido` = id do Pedido e
  liga `tool_context.actions.skip_summarization`: o evento da ferramenta vira a resposta final, e o
  modelo não é chamado de novo (uma chamada a menos no teto de custo e no tempo). Numa continuação
  (`kind` no estado), ela recusa com `{erro}`: a continuação não pergunta de novo (spec, "O Agente
  `assistente`"). Fora de um Pedido, `{erro}`, como a `ler_mensagens`.
- **Fim do Pedido com pergunta.** Depois do Runner, `execute` relê a sessão; se
  `pergunta_do_pedido` é o id do Pedido, o desfecho é `question`, sem `reply`. Uma falha ao contar ou
  ao gravar a pergunta é exceção na ferramenta e vira o "não consegui", como a leitura que falha.
- **A continuação e a guarda de reentrega.** Para a continuação, `execute` cria primeiro uma sessão
  marcadora com o id dela (estado `continuacao_de` = pai): é a mesma guarda atômica do Pedido `new`
  (a segunda entrega simultânea esbarra no `AlreadyExistsError` e termina `discarded`) e é o que a
  conferência de reentrega da rota já procura, então a entrega repetida responde 202 sem rodar nem
  gastar o limite. Depois roda o Runner na sessão do pai (`session_id` = `parent_request_id`, mesmo
  `user_id`), com o `state_delta` da continuação, que troca o Pedido, o instante e o `kind` do
  estado: as ferramentas agem no Pedido da continuação. Sem a sessão do pai (perdida), roda na
  marcadora, sem o contexto da pergunta, e as instruções tratam a Mensagem como um pedido novo.
- **Instruções.** `build_instruction` troca a pergunta em texto da F11-T04 pela `perguntar_recorte`
  ("um pedido de resumo sem período, Pessoa nem assunto: chame `perguntar_recorte` e não escreva
  nada") e ganha a continuação: quando a última ação do Agente nesta conversa foi a pergunta, a
  Mensagem é a resposta; o Recorte vem do começo do rótulo ("Hoje" → `hoje`, "Desde ontem" →
  `desde_ontem`, "A semana" → `semana`, "Tudo" → `tudo`, ignorando o número) ou do que ela escreveu
  (período, Pessoa ou assunto); se não responde, a frase fixa `NAO_ENTENDI` ("Não entendi qual
  período resumir. Para pedir um resumo, mencione o Agente de novo com o período, como hoje ou a
  semana."), sem ler e sem perguntar de novo. O reconhecimento vem do histórico da sessão, e não do
  `kind`, para a avaliação de vários turnos (que não troca o estado entre turnos) seguir o mesmo
  caminho da produção.
- **Avaliação.** O `fixture_tool_callback` responde também à `perguntar_recorte`, com as contagens
  da fixture e o mesmo `quick_reply_labels`, marcando o estado e o `skip_summarization` como a
  ferramenta. No primeiro turno dos casos novos, a resposta final é o evento da ferramenta, sem
  texto: a rubrica geral "portugues" passa a dizer "o texto da resposta, quando há", e o
  `hallucinations_v1` não avalia turno sem texto. Os casos usam a fixture `canal-geral`.
- **Constantes da pergunta na web.** Nenhuma: o cliente decide o vencimento pelo `expires_at` do
  payload, e a validade fica só na API do chat.
- **Cliente.** `MessagePayload.quick_replies` opcional no `chat-events` (evento antigo sem o campo);
  `Message.quickReplies` (`{ options, ownerId, expiresAt, closed } | null`) no service e no
  `messageFromEvent`. `utils/quick-replies.ts`, `quickRepliesState(quickReplies, personId, now)`:
  `"active" | "other_member" | "closed"`, função pura. `components/agent/quick-replies.tsx`
  (`"use client"`): os botões do Button `secondary` `sm`, a linha de estado com o ícone `Clock` e o
  texto do Figma, e um temporizador até o `expires_at` que troca o estado sem recarregar. O
  `MessageItem` da Mensagem de bot o renderiza abaixo do AgentText com `onQuickReply`, que o
  `MessageHistory` liga ao `send` do envio comum, sem Citação.
- **A atualização que encerra.** O cliente descarta o `message.updated` sem `edited_at` mais novo
  (F06). O encerramento não muda `edited_at`, então `isNewerEdit` e `recordEdit` passam a aceitar
  também a versão que fecha as Respostas prontas (`closed` de falso para verdadeiro, nunca o
  contrário), e a recuperação de edições do `useRealtimeMessages` e do `reloadLatest` inclui essas
  versões. Registrado no LLD, "Pedido ao agente e Pergunta pendente".
- **Playwright sem o modelo.** O `assistente` fica desconectado durante o teste (com o `agentsLock`,
  devolvendo o estado no fim): o Pedido `new` é criado pela rota de envio da API do chat com
  `agent_username` `assistente` (sem o BFF), e o clique passa pelo BFF, que recebe 409 do Serviço de
  agentes e encerra a continuação como `cancelled`, sem erro na tela e sem o modelo. O bot do teste
  grava a pergunta por `botQuestion(requestId, body, labels)`, novo em `e2e/support/bot.ts`. O
  vencimento é provado mudando o `expires_at` da pergunta no banco (`e2e/support/database.ts`) para
  alguns segundos à frente antes de a Ana abrir a Conversa.

## Arquivos e interfaces

- `packages/chat-events/index.d.ts`: `QuickRepliesPayload`; `MessagePayload.quick_replies?`.
- `apps/chat-api/src/agent-requests/pending-question.entity.ts`: nova, `PendingQuestion`.
- `apps/chat-api/src/agent-requests/pending-questions.service.ts`: novo, `PendingQuestionsService`
  (`open`, `takeOpen`, `viewsByMessages`).
- `apps/chat-api/src/agent-requests/agent-requests.service.ts`: `openContinuation`.
- `apps/chat-api/src/agent-requests/agent-request-values.ts`: `PENDING_QUESTION_TTL_MS`.
- `apps/chat-api/src/agent-requests/agent-requests.module.ts`: a entidade e o service.
- `apps/chat-api/src/messages/message.entity.ts`: `quickReplies`.
- `apps/chat-api/src/messages/messages.service.ts`: o envio com a Pergunta pendente,
  `insertBotMessage` com rótulos, `countForBot`, `publishClosedQuestion`, `quickReplies` no
  `withDetails`.
- `apps/chat-api/src/messages/message.response.ts`: `quick_replies`.
- `apps/chat-api/src/bot/bot.controller.ts`: `GET message-counts`, `POST question`.
- `apps/chat-api/src/bot/bot-actions.service.ts`: `countMessages`, `question`.
- `apps/chat-api/src/bot/bot-counts.query.ts`, `bot-counts.response.ts`, `question.dto.ts`: novos.
- `apps/chat-api/migrations/<instante>-AddPendingQuestions.ts`: nova, gerada e renomeada para depois
  da última; a única parcial escrita à mão se o gerador não a expressar.
- `apps/chat-api/test/support/bot-routes.ts`: `question`, `messageCounts`, `expireQuestion`,
  `openQuestion`.
- `apps/chat-api/test/bot-question.e2e-spec.ts` e `pending-questions.e2e-spec.ts`: novos;
  `realtime-bot.e2e-spec.ts`: os casos de CA2 e CA4.
- `apps/agents/app/chat_api.py`: `message_counts`, `question`.
- `apps/agents/app/agent_requests/question.py`: novo.
- `apps/agents/app/agent_requests/context.py`: `KIND`, `QUESTION_FOR`, `CONTINUATION_OF`.
- `apps/agents/app/agent_requests/execution.py`: a sessão da continuação, o desfecho `question`.
- `apps/agents/app/agents/assistente/tools.py`, `agent.py` e `instructions.py`.
- `apps/agents/app/eval_fixtures.py`: a `perguntar_recorte` na fixture.
- `apps/agents/tests/unit/test_question.py`: novo.
- `apps/agents/tests/integration/conftest.py`: a API falsa responde às contagens e à pergunta.
- `apps/agents/tests/integration/test_request_question.py`: novo.
- `apps/agents/tests/eval/assistente/assistente.evalset.json` e `test_config.json`.
- `apps/web/src/app/services/chat-api.ts`: `QuickReplies`, `Message.quickReplies`.
- `apps/web/src/app/utils/message-event.ts`, `message-pages.ts`: o payload e a atualização que
  encerra.
- `apps/web/src/app/hooks/use-realtime-messages.ts`, `use-message-history.ts`: as versões que
  encerram.
- `apps/web/src/app/utils/quick-replies.ts` e `.test.ts`: novos.
- `apps/web/src/app/components/agent/quick-replies.tsx`: novo, `QuickReplies`.
- `apps/web/src/app/components/message/message-item.tsx`: `onQuickReply`.
- `apps/web/src/app/components/conversation/message-history.tsx`: liga ao `send`.
- `apps/web/e2e/support/bot.ts` (`botQuestion`), `support/database.ts` (`setQuestionExpiry`),
  `e2e/agentes/respostas-prontas.spec.ts`, `e2e/acessibilidade/respostas-prontas-sem-violacoes.spec.ts`
  e a seção da F11-T07 em `e2e/plano-de-testes-f11.md`.
- Nesta pasta: `avaliacao.md`, `validacao-visual.md` e `capturas/`.

## Testes existentes que mudam

- Os testes da API que comparam a Mensagem inteira do REST ou de um evento (`toEqual` no corpo)
  passam a esperar `quick_replies: null`, se houver algum assim.
- `apps/web` Vitest de `message-pages` e `message-event`, se conferem o objeto inteiro: o campo
  `quickReplies` nulo.

## Mudança de dados

Nenhuma além da migração: a coluna nasce nula e a tabela, vazia.

## Documentos atualizados

- `docs/lld.md`, seção "Pedido ao agente e Pergunta pendente": a primeira Mensagem de quem pediu
  encerra também a pergunta vencida, sem continuação; a continuação roda na sessão do pai com a
  sessão marcadora como guarda de reentrega (no lugar da pendência da F11-T06); o cliente aceita o
  `message.updated` que encerra sem `edited_at` novo. `planejados`.
- `docs/lld.md`, seção "Interfaces": a contagem com `until` exclusivo, como a leitura.
