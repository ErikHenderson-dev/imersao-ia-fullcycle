# Spec · F11 · Resumo de conversa pelo agente

2026-11-11 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F11 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

## Problema

Quem volta a uma Conversa precisa rolar o histórico inteiro para recuperar o contexto, e o
`@assistente`, conectável desde a F10, ainda não atende nenhum Pedido (PRD, seção 1, "Resumo
executivo").

## Solução

É o primeiro Pedido que um Agente atende, e por isso a F11 constrói o caminho inteiro do HLD, seção
6.3, que as F12 a F14 reaproveitam:

- o BFF orquestra o disparo ([ADR 0009](../../adr/0009-bff-dispara-agente.md));
- a API do chat grava a Mensagem, resolve a Pergunta pendente e cria o Pedido numa transação só;
- o Serviço de agentes roda o `assistente` pelo `Runner` do ADK e age na Conversa como bot, pelas
  rotas `/v1/bot/...` da API do chat ([ADR 0010](../../adr/0010-agente-grava-como-bot.md)), sempre
  dentro de um Pedido real ([ADR 0011](../../adr/0011-identificador-de-pedido.md)).

O modelo nunca calcula data, contagem nem botão: as ferramentas do Agente fazem isso em código, e o
modelo só escolhe o Recorte e escreve. A Mensagem passa a ter autor Pessoa ou bot
([ADR 0028](../../adr/0028-bots-numa-tabela-propria.md)), e a tela ganha a Mensagem do Agente, as
Respostas prontas e o "digitando" do Agente. O fluxo completo está no PRD, seção 2, "Fluxo".

## Histórias de usuário

As histórias 1 a 7 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá. Do ponto de vista de quem constrói e opera:

1. Como Serviço de agentes, quero ler as Mensagens de um Recorte e gravar na Conversa só com o
   identificador de um Pedido real, para nunca agir fora do que uma Pessoa pediu.
2. Como API do chat, quero recusar qualquer ação de bot com Pedido vencido, encerrado ou de outra
   Conversa, para que uma credencial vazada ou uma resposta atrasada não grave nada.
3. Como BFF, quero saber, na resposta do envio, se a Mensagem virou um Pedido novo ou a continuação
   de uma Pergunta pendente, para chamar o Serviço de agentes uma vez só, mesmo com duas abas.
4. Como quem opera a instalação, quero trocar o provedor e o modelo de IA por uma variável de
   ambiente, para comparar modelos na avaliação sem mudar código.
5. Como quem opera a instalação, quero ver no log o tempo, os tokens e o desfecho de cada Pedido,
   ligados pelo identificador, para acompanhar custo e falhas.
6. Como quem mantém o Agente, quero uma avaliação que reprove resumo com afirmação sem lastro, para
   trocar instruções ou modelo sem perder a fidelidade.

## Decisões de implementação

### Autor da Mensagem (API do chat e `packages/chat-events`)

- A tabela `messages` troca `author_id` por `author_person_id` e `author_bot_id`, ambos anuláveis,
  com chave estrangeira para `people` e `bots`, e um CHECK que exige exatamente um dos dois. A
  migração renomeia a coluna de hoje para `author_person_id`.
- O payload do autor passa a ser `{ kind: "person" | "bot", id, name, username }`, no REST, no
  histórico e nos eventos. A função única que monta a Mensagem (LLD, "Concorrência e
  idempotência") é quem resolve o autor.
- **Não lidas:** uma Mensagem de bot é de "outro autor" para todos os Membros e conta como Não lida
  (PRD, regra de Não lidas). A comparação com a Pessoa trata `author_person_id` nulo como outro
  autor.
- **Notificações:** a Notificação de Conversa direta conta só Mensagens de autor Pessoa. A Mensagem
  do bot nunca gera Notificação, porque ela cita pelo nome e não grava Menção.
- **Editar e apagar:** a Mensagem de bot não pode ser editada nem apagada por nenhuma Pessoa, com o
  mesmo erro de editar a Mensagem de outro autor.
- O bot não é Membro de nenhuma Conversa. Ele grava numa Conversa só pelo Pedido feito nela.

### Pedido e ações de bot (API do chat)

**Tabela `agent_requests`**, `planejada`:

| Coluna | Tipo |
| --- | --- |
| `id` | UUID v7, chave primária: é o identificador de pedido |
| `conversation_id` | chave estrangeira |
| `requester_id` | chave estrangeira para `people` |
| `bot_id` | chave estrangeira para `bots` |
| `trigger_message_id` | chave estrangeira para `messages`: a Mensagem do Pedido |
| `kind` | `new` ou `continuation` |
| `parent_request_id` | anulável: na continuação, o Pedido que fez a pergunta |
| `status` | `open`, `failed` ou `cancelled` |
| `expires_at` | `created_at` mais a validade do identificador de pedido, 2 min |
| `created_at`, `updated_at` | `timestamptz` |

**Tabela `bot_actions`**, `planejada`: chave primária `(request_id, action_type)`, `message_id` e
`created_at`. Na F11, os tipos são `reply` e `question`. Repetir uma ação devolve a Mensagem já
gravada, sem nova Mensagem nem evento, como manda o LLD ("Ação de bot"). O "digitando" não é ação e
não entra na tabela.

**Ação aceita só se:** a credencial de bot confere, o Pedido existe, está `open`, não venceu e a
ação é na Conversa dele. Erros do catálogo: `request_not_found` (404, também para id malformado),
`request_expired` (410) e `request_closed` (409, para `failed` e `cancelled`). Uma Mensagem apagada
do Pedido não muda nada disso (PRD, "O Pedido vale pelo que foi enviado").

**Encerramento pelo BFF:** `POST /v1/agent-requests/:id/close`, com a Sessão de quem pediu e corpo
`{ "status": "failed" | "cancelled" }`, responde 204. Outra Pessoa recebe `request_not_found`.
Encerrar um Pedido já encerrado responde 204 sem mudar nada.

### Envio e Pergunta pendente (API do chat)

**Tabela `pending_questions`**, `planejada`: `id`, `request_id` (o Pedido que perguntou),
`conversation_id`, `person_id`, `bot_id`, `question_message_id`, `expires_at` (1 h depois da
pergunta), `closed_at` anulável e `created_at`. Um índice único parcial em
`(conversation_id, person_id)` onde `closed_at` é nulo garante uma pergunta aberta por Pessoa e
Conversa. Uma pergunta nova do bot encerra a anterior.

**Envio de Mensagem:** a rota de envio que existe ganha o campo opcional `agent_username`, que o BFF
preenche com o `@usuário` do Agente conectado mencionado. Um `agent_username` que não é bot recebe
`bot_not_found` (422). Na mesma transação da gravação, com a linha da Pergunta pendente travada:

1. Com `agent_username`: encerra a Pergunta pendente aberta, se houver, e cria um Pedido `new`.
2. Sem `agent_username` e com Pergunta pendente aberta e não vencida: encerra a pergunta e cria um
   Pedido `continuation`, com o bot e o `parent_request_id` da pergunta.
3. Sem nenhum dos dois: só grava a Mensagem.

A resposta ganha `agent_request: { id, kind, bot_username, parent_request_id } | null`. Duas abas
enviando ao mesmo tempo criam um Pedido só, porque a segunda encontra a pergunta já encerrada. Uma
pergunta vencida se reconhece pelo `expires_at` na leitura, sem rotina de expiração.

**Respostas prontas:** a Mensagem do bot ganha a coluna `quick_replies jsonb`, anulável, com a lista
de rótulos. No payload, a Mensagem leva `quick_replies: { options, owner_id, expires_at, closed } |
null`, com `closed` verdadeiro quando a Pergunta pendente dela foi encerrada. Ao encerrar a
pergunta, a API publica `message.updated` da Mensagem da pergunta, que desativa os botões em tempo
real. A expiração por tempo não publica nada: o cliente desativa pelo `expires_at`.

### Rotas do bot e credencial (API do chat)

- **Credencial de bot:** um segredo único, `CHAT_BOT_TOKEN`, na API do chat e no Serviço de agentes,
  enviado em `Authorization: Bearer` e conferido com comparação de tempo constante, como a
  credencial de serviço da F10. Sem ela, ou com a errada, toda rota `/v1/bot` responde 401
  `invalid_bot_token`. O alcance de cada ação vem do Pedido.
- As rotas ficam sob o Pedido, então a Conversa vem dele e nunca do chamador:

| Rota | O que faz |
| --- | --- |
| `GET /v1/bot/requests/:id/messages?since=&until=&author_username=` | As Mensagens de Pessoas, sem as apagadas, entre `since` e `until` (instantes UTC, ambos opcionais), da mais antiga para a mais nova, no máximo as 500 mais recentes, e `total` com a contagem do Recorte inteiro. Cada uma traz `id`, autor (`name`, `username`), `body` atual e `created_at` |
| `GET /v1/bot/requests/:id/message-counts?since=…&since=…` | A contagem de Mensagens de Pessoas não apagadas desde cada `since`, e de tudo, de uma vez |
| `POST /v1/bot/requests/:id/typing` | Emite o "digitando" do bot na Conversa. 204 |
| `POST /v1/bot/requests/:id/reply` | Grava a resposta (`body`) como bot, ação `reply`, e emite o fim do "digitando" |
| `POST /v1/bot/requests/:id/question` | Grava a pergunta (`body`, `quick_replies`) como bot, ação `question`, abre a Pergunta pendente para quem pediu e emite o fim do "digitando" |

- O teto de 500 Mensagens vale só nessas rotas. O "Tamanho da página" do histórico não muda.
- As leituras usam o índice que existe em `(conversation_id, id)`, com o `created_at` derivado do
  UUID v7. Um índice novo só entra se a medição pedir.
- `body` obedece o "Tamanho máximo da Mensagem". A API não conhece fuso: recebe e devolve UTC.

### "Digitando" do bot (API do chat, `packages/chat-events` e web)

- O evento de digitando troca `person` por `author`, com o mesmo formato do autor da Mensagem. O
  "digitando" de Pessoa continua igual por dentro.
- O Serviço de agentes chama a rota de digitando ao começar e de novo a cada "Intervalo do aviso de
  digitando" (3 s) enquanto roda. O cliente já apaga o aviso depois da "Expiração do digitando"
  (5 s) sem renovação, e é isso que encerra o aviso se o Serviço de agentes cair no meio do Pedido.
  A gravação da resposta ou da pergunta emite o fim na hora.

### Disparo pelo BFF (web)

A Server Action de envio que existe passa a orquestrar o Pedido:

1. Se o texto tem um `@usuário` que bate com um Agente conectado, pelo `GET /v1/agents` do Serviço
   de agentes, com a mesma regra de limite de palavra do cliente, o BFF manda `agent_username`. Sem
   `@` no texto, não chama o registro. Com o registro fora, envia sem `agent_username`, e a Menção
   fica como texto comum.
2. Envia a Mensagem à API do chat.
3. Com `agent_request` na resposta, chama `POST /v1/requests` do Serviço de agentes com a
   credencial de serviço, esperando só o aceite.
4. Devolve ao cliente a Mensagem gravada e, se o Pedido não foi aceito, o campo de erro do Agente
   que o LLD já define ("Erros"), com o motivo `unavailable` ou `rate_limited`.

Se o passo 3 falha (Serviço de agentes fora, tempo esgotado ou 429), o BFF encerra o Pedido como
`failed`. Com 409 `agent_not_connected`, encerra como `cancelled` e não mostra erro: a Menção a um
Agente desconectado é texto comum. A Pergunta pendente que a Mensagem encerrou não é reaberta. O
clique numa Resposta pronta é um envio comum do texto do botão por essa mesma Action.

### Rota de Pedido (Serviço de agentes)

`POST /v1/requests`, com a credencial de serviço. O corpo traz `request_id`, `kind`,
`parent_request_id`, `agent` (o `slug`), `conversation_id`, `message` (`id` e `body`), `requester`
(`id`, `name` e `username`), `mentions` (`username` e `name` de cada Pessoa mencionada) e
`time_zone` (IANA).

- Confere, nesta ordem: o Agente existe no catálogo (`agent_not_found`, 404) e está conectado
  (`agent_not_connected`, 409); o limite de pedidos da Pessoa (`rate_limited`, 429). Depois responde
  202 e roda o Pedido numa tarefa em segundo plano, no mesmo processo. A entrega repetida do mesmo
  Pedido, inclusive a simultânea, é aceita sem rodar nem gastar o limite (LLD, seção "6.5 Pedido ao
  agente e Pergunta pendente").
- **Limite de pedidos:** um contador por Pessoa e minuto no Redis, em janela fixa, somando todas as
  Conversas. O valor é a variável `AGENT_REQUESTS_PER_MINUTE`, padrão 10. Com o Redis fora, o
  Pedido é recusado com `agents_unavailable` (503), como manda o HLD. O Serviço de agentes ganha a
  dependência do Redis e a variável `REDIS_URL`.
- `mentions` são as Menções a Pessoas que a API do chat resolveu na gravação, para o modelo receber o
  nome de quem foi citado.

### Execução do Pedido (Serviço de agentes)

- **Sessão do ADK:** `user_id` é o id de quem pediu. Um Pedido `new` abre uma sessão nova, com o id
  do Pedido. Uma `continuation` retoma a sessão do `parent_request_id`, então o Agente responde
  com o contexto da pergunta. O `DatabaseSessionService` que existe guarda as sessões.
- **Contexto:** o identificador, a Conversa, quem pediu e o fuso entram por `state_delta` e as
  ferramentas os leem pelo `ToolContext`. O modelo não os vê, então não consegue trocar de Conversa
  nem de Pedido.
- **Cliente da API do chat:** um módulo compartilhado que fala com as rotas `/v1/bot` com a
  credencial de bot e o endereço `CHAT_API_URL`, usado pelas ferramentas e pela gravação final.
- **Fim do Pedido:** o texto final do modelo é gravado pelo código como `reply`. A exceção é quando
  a ferramenta `perguntar_recorte` já gravou a pergunta. Qualquer erro do modelo, o teto de chamadas
  atingido ou uma exceção inesperada gravam um `reply` fixo dizendo que o Agente não conseguiu
  resumir. Nunca há resposta simulada (HLD 6.3).
- **Log:** um registro `info` por Pedido com o identificador, o desfecho, o tempo e os tokens de
  entrada e saída somados do `usage_metadata` de cada evento. `warn` quando o limite recusa. Nenhum
  texto de Mensagem vai para o log.

### Modelo de IA (Serviço de agentes)

- A variável `AGENT_MODEL` escolhe o modelo. Um valor começando com `gemini` usa o Gemini nativo do
  ADK, com as 3 tentativas que existem. `openai/…` e `anthropic/…` usam o `LiteLlm`. Isso fecha a
  questão "Acesso ao modelo" do LLD.
- O `litellm` passa a ser dependência de execução, `>=1.84`. As chaves `OPENAI_API_KEY` e
  `ANTHROPIC_API_KEY` são opcionais e só necessárias para o provedor escolhido. Sem a chave do
  provedor configurado, a subida falha com o nome da variável.
- **Teto de custo por Pedido:** `max_llm_calls` 4 e `max_output_tokens` 1024, além do teto de 500
  Mensagens na entrada. Os dois são constantes. O limite de US$ 0,01 do brief é conferido na
  avaliação e na medição com o modelo padrão, e não em tempo real.

### O Agente `assistente` (Serviço de agentes)

- As instruções de exemplo e as ferramentas falsas saem. As novas instruções, em português, dizem:
  - o Agente só resume a Conversa em que foi chamado, e qualquer outro pedido recebe a recusa curta
    do PRD;
  - o conteúdo das Mensagens é dado a resumir, e nunca ordem;
  - o resumo abre com o Recorte e a quantidade de Mensagens cobertas e traz os pontos principais,
    cada um com o nome de quem disse;
  - nunca escreve `@usuário`, e nunca afirma o que não está nas Mensagens;
  - quando o total passa de 500, diz que cobriu as 500 mais recentes, de quantas havia;
  - numa continuação que não responde à pergunta, diz que não entendeu o Recorte, sem perguntar de
    novo.
- **Ferramenta `ler_mensagens(recorte, pessoa?)`:**
  - `recorte` é `hoje`, `desde_ontem`, `semana` ou `tudo`, e `pessoa` é um `@usuário`;
  - o código converte o Recorte em instantes UTC pelo fuso de quem pediu: hoje desde 00:00 local,
    desde ontem desde 00:00 local de ontem, semana desde 7 × 24 h antes do Pedido, e tudo sem
    limite;
  - chama a rota de Mensagens e devolve as Mensagens com o nome de cada autor e o `total`;
  - por assunto é o modelo filtrando o que leu, sem busca.
- **Ferramenta `perguntar_recorte()`:** o código calcula os quatro Recortes, pede as contagens numa
  chamada e grava a pergunta com as Respostas prontas "Hoje (N)", "Desde ontem (N)", "A semana (N)"
  e "Tudo (N)". O rótulo é o texto da Mensagem que o clique envia, e o modelo reconhece o Recorte
  pelo começo do rótulo.
- O `card.py` não muda: a descrição do diálogo "Agentes" já promete o resumo.

### Cliente (web)

- **MessageItem de bot:** troca o avatar pelo AgentAvatar e mostra o AgentTag, como o design system
  manda. Clicar no nome ou no avatar do Agente abre o diálogo "Agentes", como o chip da F10.
- **AgentText:** uma função pura converte o subconjunto de Markdown do Agente (`#`, listas com `-`,
  parágrafos e **negrito**) nos blocos do AgentText. O que ela não reconhece vira parágrafo, e nada
  vira HTML nem link.
- **Respostas prontas:** um componente novo abaixo do AgentText. Uma função pura decide o estado de
  cada pergunta (ativa para o dono, desativada para outro Membro, desativada depois de encerrada ou
  vencida) a partir do payload, da Pessoa da Sessão e da hora. Os botões ativos recebem foco na
  ordem da Mensagem e disparam com Enter ou Espaço. O desativado para outro Membro explica, no
  rótulo acessível, que é de quem pediu.
- **"Digitando":** o aviso mostra o nome do Agente, a partir do `author` do evento.
- **Erro do Agente:** o aviso ao lado da Mensagem enviada, já previsto no LLD, ganha os textos de
  `unavailable` ("O Assistente não recebeu o pedido. Mencione de novo.") e `rate_limited` ("Muitos
  pedidos em pouco tempo. Tente de novo em um minuto.").
- **Figma, antes do código:** o Figma é conferido e completado com os frames do PRD ("Todas as
  histórias"), no padrão `<Fluxo> / <Grupo> / <Estado>`. São eles: a Mensagem do Agente com resumo
  e com o aviso de teto, a pergunta com as Respostas prontas ativas, desativadas para outro Membro
  e encerradas, o Agente digitando, a recusa, o "não consegui" e os dois erros do Agente. Tudo nos
  dois temas, antes da tarefa da tela.

### Ambiente de desenvolvimento

- O `compose.yaml` passa `REDIS_URL`, `CHAT_API_URL` (`http://chat-api:3000`), `CHAT_BOT_TOKEN` e
  `AGENT_MODEL` ao `agents`, e `CHAT_BOT_TOKEN` ao `chat-api`. O bot do `assistente` continua sendo
  criado pelo comando de contas, como na F10.
- Os testes de integração do Serviço de agentes usam um banco lógico próprio do Redis, como a API
  do chat faz com `TEST_REDIS_URL`.

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que o Agente grava, o que aparece na tela), e não a forma
interna. A forma de cada teste da API do chat está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de ponta a ponta por HTTP com banco real**, onde fica a maior parte das regras:

- envio com `agent_username` cria um Pedido `new`; sem ele e com Pergunta pendente aberta, cria um
  `continuation` com o `parent_request_id`; sem nenhum dos dois, `agent_request` é nulo;
  `agent_username` de quem não é bot recebe `bot_not_found`;
- a Pergunta pendente se encerra na primeira Mensagem de quem pediu, seja qual for, numa Menção
  nova ao Agente e depois de 1 h, e uma Mensagem de outro Membro não a encerra;
- dois envios simultâneos da mesma Pessoa com a pergunta aberta criam um Pedido só;
- as rotas `/v1/bot` respondem 401 sem a credencial ou com a errada, `request_not_found` com id
  desconhecido, `request_expired` depois de 2 min e `request_closed` com Pedido `failed` ou
  `cancelled`;
- `reply` e `question` repetidas devolvem a mesma Mensagem, sem duplicar;
- a leitura respeita `since`, `until` e `author_username`, traz só Pessoas e não traz apagadas, corta
  nas 500 mais recentes com o `total` certo, e as contagens batem com a leitura;
- a Mensagem do bot sai com `author.kind` `bot` no histórico e na resposta, conta como Não lida,
  não gera Notificação nem numa Conversa direta, e não pode ser editada nem apagada;
- `POST /v1/agent-requests/:id/close` encerra o Pedido de quem pediu e recusa o de outra Pessoa;
- a migração preserva o autor das Mensagens existentes em `author_person_id`, e o CHECK recusa
  linha sem autor ou com os dois.

**API do chat, teste de ponta a ponta com o servidor real e `socket.io-client`:** a resposta e a
pergunta do bot chegam como `message.created` a quem está na Conversa; o encerramento da pergunta
chega como `message.updated` com `closed`; o "digitando" do bot chega com `author.kind` `bot`.

**Serviço de agentes, testes de unidade (`tests/unit`):** a conversão dos Recortes em UTC por fuso,
inclusive a virada do dia e um fuso diferente do padrão; a escolha entre Gemini nativo e `LiteLlm`
por `AGENT_MODEL`; a configuração falha sem a chave do provedor escolhido.

**Serviço de agentes, testes de integração (`tests/integration`)**, com o app real pelo `httpx`, o
modelo real (regra do projeto) e uma API do chat falsa num servidor temporário em `127.0.0.1`:

- `POST /v1/requests` responde 401 sem a credencial, 404 para Agente fora do catálogo, 409 para
  Agente desconectado, 202 no aceite e 429 no 11º Pedido da mesma Pessoa no minuto;
- um Pedido com Recorte grava um `reply` na API falsa, depois de ler as Mensagens do Recorte certo;
- um Pedido sem Recorte grava uma `question` com as quatro contagens, e a continuação com
  "Hoje (N)" retoma a mesma sessão e grava o resumo de hoje;
- uma API falsa que falha na leitura faz o Pedido gravar o "não consegui".

**Serviço de agentes, avaliação com o `adk eval`:** o evalset do `assistente` troca os 2 casos de
exemplo por cerca de 24 casos:

- os seis Recortes com variações de escrita;
- sem Recorte → pergunta, e a resposta escrita, num caso de vários turnos;
- a resposta que não responde;
- Recorte vazio;
- Conversa acima do teto;
- três pedidos fora de escopo;
- duas Conversas com instruções injetadas;
- a mesma Pessoa citada pelo nome e por Menção.

As Conversas vêm de fixtures injetadas por `before_tool_callback`. Os critérios do `test_config`
são `tool_trajectory_avg_score` IN_ORDER 1.0, que confere o Recorte escolhido,
`rubric_based_final_response_quality_v1`, com rubricas de fidelidade, cobertura, nomes sem
`@usuário` e aviso de teto, e `hallucinations_v1`. A meta é ≥ 98% dos casos aprovados (brief,
"Qualidade do agente"), e o `token_usage_v1` informa o custo por caso. A avaliação fica fora da
Verificação completa, como manda o `AGENTS.md` do projeto.

**Web, Vitest para as funções puras:** a conversão do Markdown do Agente em blocos do AgentText,
inclusive o que não é reconhecido; o estado das Respostas prontas para o dono, para outro Membro,
encerradas e vencidas; o reconhecimento do `agent_username` no texto com o limite de palavra.

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F11 junto dos testes. O Agente começa conectado e o bot criado. Duas
Pessoas em dois contextos do navegador:

- com o modelo real, um teste só: "@assistente resume hoje" faz o resumo aparecer para as duas
  Pessoas sem recarregar;
- os outros estados com o bot agindo direto pelas rotas `/v1/bot`, a partir do Pedido que o envio
  criou e sem o modelo. São eles: a pergunta com botões ativos para quem pediu e desativados para a
  outra Pessoa, o clique que vira Mensagem e desativa os botões para as duas, a pergunta vencida, o
  "digitando" do Agente, a recusa e o "não consegui";
- com o Serviço de agentes parado, o erro do Agente aparece só para quem pediu, e o Pedido fica
  `failed`;
- tudo pelo teclado, e a checagem de acessibilidade com `@axe-core/playwright` na Conversa com a
  Mensagem do Agente e as Respostas prontas, nos dois temas, sem violações.

**Medição:** o p95 ≤ 5 s do Pedido comum, da Mensagem enviada até a resposta aparecer, medido com o
modelo padrão numa Conversa de 500 Mensagens, registrado na pasta da tarefa que fecha o caminho.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois
temas, comparada com o `get_screenshot` dos frames novos (`docs/design-system.md`, "Validação
visual"), registrada na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse nos dois temas, com uma Conversa que tem um resumo e uma pergunta com Respostas
prontas.

**Exemplos anteriores:** na API do chat, os testes de Mensagens e Menções da F06 e os de tempo real
da F03 e da F10; no Serviço de agentes, os testes de integração das rotas da F10 e o servidor
temporário que eles usam; na web, os testes do autocompletar de Agentes e do "digitando".

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- Pedido demorado, fila e Worker: F14.
- A marca "dados de negócio" na Mensagem e a entrega bloqueada: F13.
- A ação `task` e os avisos de Tarefa: F12.
- Uma credencial de bot por Agente: entra quando houver mais de um processo ou de um Agente.
- Conversão de tokens em dólar a cada Pedido e teto de custo em tempo real.
- Busca de Mensagens por assunto no banco: o assunto é filtrado pelo modelo.
- Reabrir a Pergunta pendente quando o Pedido que a encerrou falha.
- O snapshot OpenAPI das rotas novas, que segue planejado no LLD.

## Observações

- O glossário ganhou Pedido, Recorte, Pergunta pendente e Resposta pronta, e a definição de Agente
  passou a incluir as respostas às Perguntas pendentes.
- O LLD muda em "Segurança" (credencial de bot), "Concorrência e idempotência" (tipos de ação),
  "Dados" (autor da Mensagem, Pedidos, Perguntas pendentes), "Interfaces" (rotas do bot, rota de
  Pedido, envio e encerramento), "Estados e regras" (pedido ao agente e pergunta pendente), "Valores
  e configuração" (validade de 2 min, limite como variável, teto de custo, validade da pergunta de
  1 h, variáveis novas), "Decisões" e "Questões em aberto" (acesso ao modelo, credenciais de bot,
  perguntas pendentes vencidas). O HLD não muda: o caminho do HLD 6.3 é o que esta spec constrói.
- Decisões novas, sem ADR, porque os ADRs 0009, 0010, 0011 e 0028 já as cobrem: a Pergunta
  pendente resolvida na transação do envio, as rotas do bot sob o Pedido e o autor em duas colunas.
- O "digitando" do bot se encerra pela expiração que o cliente já tem, de 5 s, renovado pelo
  Serviço de agentes a cada 3 s, em vez de um temporizador de 30 s no servidor. O efeito decidido
  continua: o aviso nunca fica preso se o Serviço de agentes cair.
- Se o processo do Serviço de agentes morrer no meio de um Pedido, nada é gravado e o "digitando"
  some em 5 s. É o único caso sem "não consegui" na Conversa. Fica aceito até a F14, que traz a
  fila com novas tentativas.
