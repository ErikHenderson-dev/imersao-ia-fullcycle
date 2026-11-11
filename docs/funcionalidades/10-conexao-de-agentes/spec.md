# Spec · F10 · Conexão de agentes

2026-11-11 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F10 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

## Problema

Nenhum Agente aparece no chat, ninguém decide quais o workspace usa e o papel de administrador não
existe (PRD, seção 1, "Resumo executivo").

## Solução

O registro de Agentes conectados fica no Serviço de agentes, no Banco dos agentes, como manda o
[ADR 0008](../../adr/0008-agentes-como-modulos.md). O catálogo dos Agentes disponíveis fica no
código de cada módulo, e o banco guarda só quais estão conectados. O Serviço de agentes ganha as
primeiras rotas `/v1`, protegidas pela credencial de serviço. Em produção, ele deixa de expor as
rotas genéricas do ADK. A Pessoa ganha o papel de administrador, dado pelo comando de contas, e o
Banco do chat ganha a tabela de bots, que reserva o `@usuário` de cada Agente
([ADR 0028](../../adr/0028-bots-numa-tabela-propria.md)).

O BFF faz a ponte. Ele lê o registro para a barra lateral, o diálogo e o autocompletar, e conecta e
desconecta em nome do administrador. Depois, pede à API do chat que avise o workspace com o evento
`agents.changed`, sem conteúdo, e cada cliente relê a lista. A Menção a um Agente é reconhecida no
cliente, contra a lista de conectados, sem mudar a gravação das Menções. O fluxo completo está no
PRD, seção 2, "Fluxo".

## Histórias de usuário

As histórias 1 a 6 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá.

## Decisões de implementação

### Registro de Agentes (Serviço de agentes)

**Catálogo**, no código:

- Cada pasta de `app/agents/<agente>/` ganha um `card.py`, com `NAME` (o nome de exibição, como
  "Assistente") e `DESCRIPTION` (a descrição em português do diálogo "Agentes", conferida no frame
  "Diálogos / Agentes / Admin com conectado", 26:33348).
- O `slug` do Agente é o nome da pasta, que já é o nome do `App` do ADK, e é também o `@usuário`
  dele e o `username` do bot no Banco do chat ("Bots").
- O `description` do `Agent` do ADK continua livre para o roteamento entre agentes, e não é o texto
  da tela.
- Um módulo compartilhado, `app/registry/`, descobre as pastas de `app/agents/` que têm `card.py` e
  monta o catálogo uma vez, na subida. Uma pasta sem `card.py` faz a subida falhar com o nome da
  pasta, em vez de sumir da tela em silêncio.

**Tabela `connected_agents`**, no Banco dos agentes, `planejada`:

| Coluna | Tipo |
| --- | --- |
| `slug` | texto, chave primária |
| `connected_by` | UUID da Pessoa que conectou, sem chave estrangeira (a Pessoa está em outro banco) |
| `created_at`, `updated_at` | `timestamptz` |

- Existir a linha significa estar conectado. Conectar é `INSERT … ON CONFLICT (slug) DO NOTHING`, e
  desconectar é `DELETE`. As duas operações são idempotentes: dois administradores agindo ao mesmo
  tempo acabam no estado da última ação, sem erro, e conectar o que já está conectado não muda o
  `connected_by`.
- Uma linha cujo `slug` não está mais no catálogo (um Agente removido numa versão nova) é ignorada
  na leitura, e não é apagada.
- O registro guarda `connected_by` para diagnóstico. O PRD não pede histórico, e a tela não o mostra.

**Acesso ao banco e migrações:** SQLAlchemy assíncrono (Core), com o driver asyncpg que o ADK já
usa, e migrações do Alembic em `apps/agents/migrations/`. O `env.py` do Alembic ignora as tabelas
de sessão do ADK, que o próprio ADK cria e mantém, para uma migração nunca tocá-las. A conexão vem
de `DATABASE_URL`, no mesmo banco `agents` de `SESSION_SERVICE_URI`.

**Configuração:** um módulo `app/config.py`, com `pydantic-settings`, valida e tipa as variáveis do
projeto: `DATABASE_URL`, `AGENTS_SERVICE_TOKEN`, `ADK_DEV_ROUTES` e as que o código gerado já lê
(`SESSION_SERVICE_URI`, `ALLOW_ORIGINS`). Uma variável obrigatória ausente faz a subida falhar com
o nome dela.

### Rotas e credencial (Serviço de agentes)

**Credencial de serviço:** toda rota `/v1` exige `Authorization: Bearer <AGENTS_SERVICE_TOKEN>`,
conferido com comparação de tempo constante (`hmac.compare_digest`) por uma dependência do FastAPI.
O segredo é um só, do BFF para o Serviço de agentes. A credencial de bot, do Serviço de agentes
para a API do chat, fica para a F11.

**Erros:** corpo `application/problem+json` (LLD, "Erros"), com o `code` no corpo.

| Rota | Entrada | Sucesso | Erros |
| --- | --- | --- | --- |
| `GET /v1/agents`, `planejada` | — | 200 com `agents`: `slug`, `name`, `username` e `description` de cada Agente do catálogo, e `connected` (booleano), em ordem de `name` | `unauthorized` (401) |
| `PUT /v1/agents/:slug/connection`, `planejada` | `person_id` e `is_admin` de quem pede ([ADR 0015](../../adr/0015-permissoes-enviadas-pelo-bff.md)) | 204, inclusive se já estava conectado | `unauthorized` (401), `forbidden` (403) sem `is_admin`, `agent_not_found` (404) fora do catálogo, `validation_failed` (400) |
| `DELETE /v1/agents/:slug/connection`, `planejada` | os mesmos | 204, inclusive se já estava desconectado | os mesmos |

- `unauthorized` vem antes de qualquer outra conferência, e `forbidden` antes de `agent_not_found`,
  para quem não administra não descobrir o catálogo pela resposta.

**Rotas genéricas do ADK e interface web:** a documentação do ADK ("API Server") mostra que o
`get_fast_api_app` sempre monta as rotas genéricas (`/list-apps`, `/apps/...`, `/run`, `/run_sse`),
e o parâmetro `web` liga só a interface. Abertas na rede privada, elas deixam rodar um Agente sem a
credencial, sem a conferência de conexão e sem o limite de pedidos. Por isso, `app/fast_api_app.py`
monta o app de dois jeitos, pela variável `ADK_DEV_ROUTES`:

- `true`, no Compose de desenvolvimento: o app do `get_fast_api_app`, como hoje, com o router `/v1`
  incluído nele. O `adk web`, o `adk eval` e o teste `test_server_e2e.py` continuam funcionando.
- ausente ou `false`, o padrão e o valor de produção: um `FastAPI` próprio, só com o router `/v1` e o
  healthcheck `GET /health`, sem credencial, para a PaaS.

### Bots (API do chat)

A tabela `bots`, `planejada` ([ADR 0028](../../adr/0028-bots-numa-tabela-propria.md)):

| Coluna | Tipo |
| --- | --- |
| `id` | UUID v7 |
| `username` | texto, único, com o mesmo CHECK de formato do `@usuário` das Pessoas ("Valores", "Formato do @usuário") |
| `name` | texto, com o CHECK do nome das Pessoas ("Valores", "Tamanho do nome") |
| `created_at`, `updated_at` | `timestamptz` |

- **Reserva do `@usuário`:** um `@usuário` não pode estar ao mesmo tempo em `people` e em `bots`.
  Como só o comando de contas cria `@usuário` (o `@usuário` não muda depois de criado, como diz o
  glossário), a conferência fica no comando, numa função única de "`@usuário` livre" que consulta as
  duas tabelas. A disputa entre duas execuções simultâneas do comando é desprezível e não ganha
  trava.
- Na F10, a API do chat não usa o bot para mais nada: ele não entra no login, na busca, nos Membros,
  na Presença nem nas Notificações. A F11 o liga às Mensagens como autor.
- Entidade e repositório num módulo novo, `bots`, importado pelo módulo do comando de contas.

### Papel de administrador (API do chat)

A tabela `people` ganha `is_admin`, booleano, obrigatório, padrão `false`, `planejada`. A permissão
de dados fica para a F13, como outra coluna.

| Rota | Mudança |
| --- | --- |
| `GET /v1/sessions/current`, muda | A Pessoa ganha `is_admin` |
| `GET /v1/people/:id`, muda | O Perfil ganha `is_admin`, para o selo |
| `GET /v1/people`, muda | Novo filtro `admin=true`: só os administradores. Sem `q`, devolve todos eles, até o "Limite da busca de Pessoas" ("Valores"), em ordem de nome. Cada item traz o que a busca já traz (nome, `@usuário`, cargo, Presença e Status) |

- O papel é lido do banco a cada requisição, pela Pessoa da Sessão que o guard já carrega. Por isso,
  perder o papel vale na próxima ação, sem sair e entrar (PRD, "Regras desta funcionalidade").

### Evento `agents.changed` (API do chat e `packages/chat-events`)

| Rota | Entrada | Sucesso | Erros |
| --- | --- | --- | --- |
| `POST /v1/agents/changed`, `planejada` | — | 204 | `unauthenticated` (401), `forbidden` (403) sem `is_admin` |

- A rota confere o papel da Pessoa da Sessão e publica `agents.changed` na sala `workspace`, inclusive
  para as abas de quem pediu.
- **Evento novo, sem conteúdo**, em `ServerToClientEvents`, sem guardar nos eventos por Pessoa e sem
  reenvio na reconexão, como o `person.updated` da F09. Ele só diz "releia a lista". Por isso, não
  vaza o catálogo, e quem o dispara sem ter mudado nada não forja estado.
- A recuperação de um evento perdido é a releitura da lista a cada conexão e reconexão do socket
  ("Cliente").
- Controller e service num módulo novo, `agents`, que usa o `RealtimePublisher`. O `forbidden` sai
  pelo filter global (`.claude/rules/nest-api-errors.md`).

### Comando de contas (API do chat)

Duas operações novas, no padrão das que existem (spec da F01, "Comando de contas"):

- `set-admin <e-mail|@usuário> on|off`: dá ou tira o papel e escreve o resultado ("Fulana agora é
  administradora", "Fulana deixou de ser administradora", ou "já era" quando nada muda). Um argumento
  que começa com `@` é tratado como `@usuário`.
- `create-bot <username> <nome>`: cria o bot, com as regras de formato do `@usuário` e do nome, e
  recusa um `@usuário` já usado por uma Pessoa ou por outro bot.
- `create` passa a recusar o `@usuário` de um bot, informado em `--username` ou derivado do e-mail,
  pela mesma função de "`@usuário` livre".
- Nenhuma operação publica evento: a mudança de papel aparece na próxima carga da página e na próxima
  abertura do Perfil (PRD, história 5 e 6).
- O guia de subida do ambiente (`AGENTS.md` da raiz) ganha a criação do bot `assistente` e de um
  administrador de desenvolvimento.

### BFF (web)

- **Cliente do Serviço de agentes:** um módulo de serviço no padrão de `services/chat-api.ts`, com
  `AGENTS_SERVICE_URL` e `AGENTS_SERVICE_TOKEN` lidos do schema de variáveis da web, `fetch` sem
  cache e o mesmo tempo limite.
- **Leitura `GET /api/agents`:** o catálogo com `connected`, para o diálogo e para a releitura do
  cliente. Exige Sessão (401 leva a `GET /api/session/expired`, como na F02). Uma falha do Serviço
  de agentes responde 502 com `agents_unavailable`.
- **Layout logado:** lê a mesma lista no servidor, junto da Pessoa da Sessão, para a primeira pintura
  da seção Agentes. Se a leitura falhar, o layout carrega mesmo assim, com a lista marcada como
  indisponível.
- **Server Actions `connectAgent(slug)` e `disconnectAgent(slug)`:**
  1. Leem a Pessoa da Sessão em `GET /v1/sessions/current`, sem cache, com o `is_admin`.
  2. Sem `is_admin`, devolvem `forbidden` sem chamar o Serviço de agentes.
  3. Chamam `PUT` ou `DELETE /v1/agents/:slug/connection` com o `person_id` e o `is_admin`.
  4. Com sucesso, chamam `POST /v1/agents/changed` com o cookie. Uma falha nesse passo só vai para o
     log, e a ação devolve `ok`: o estado já mudou, e os outros clientes acertam na próxima
     reconexão.
  5. Devolvem a união discriminada da F01 (`ok`, `unauthenticated`, `failure`) mais `forbidden`.
     `agent_not_found` e qualquer falha do Serviço de agentes viram `failure`.
- **Leitura dos administradores:** `GET /api/people?admin=true`, pela rota de busca que já existe,
  repassando o filtro.
- **Tipos da web:** `Agent` (`slug`, `name`, `username`, `description`, `connected`). `Person` e
  `Profile` ganham `isAdmin`.

### Cliente (web)

**Lista de Agentes no cliente**

- Um cache do SWR com a chave de `GET /api/agents`, com `fallbackData` vindo do layout.
- É relido no `agents.changed`, a cada conexão e reconexão do socket (junto do retrato de Presença
  da F09) e depois de uma ação de conectar ou desconectar que deu certo.
- Os conectados alimentam a seção Agentes, o autocompletar e o destaque das Menções.

**Seção Agentes da barra lateral**, um `SidebarSection` novo depois de "Mensagens diretas":

| Quem | Estado | Linhas | Ação |
| --- | --- | --- | --- |
| Administrador | nenhum conectado | — | "Conectar agentes", com o CountBadge do número de desconectados |
| Administrador | parte conectada | os conectados | "Adicionar agente" |
| Administrador | todos conectados | os conectados | "Gerenciar agentes" |
| Quem não administra | qualquer | os conectados | "Ver agentes" |
| Qualquer Pessoa | lista indisponível | — | "Gerenciar agentes" (administrador) ou "Ver agentes" |

- Cada linha mostra o AgentAvatar e o `name` do catálogo, como nos frames "Casca / Agentes" (PRD,
  "Critérios de aceite"). A linha e a ação abrem o diálogo "Agentes".
- A ação vira um componente `SidebarAction` compartilhado, com as variantes do design system
  (`connect`, `add`, `manage` e `view`), e "Adicionar canal" e "Nova conversa" passam a usá-lo.

**Diálogo "Agentes"**

- Dialog do Radix, com o foco no primeiro controle e a volta do foco ao fechar.
- Ao abrir, revalida a lista. Enquanto não há dados, mostra "Carregando". Na falha, mostra "Erro",
  com "Tentar de novo". Com o catálogo vazio, mostra "Vazio".
- Para o administrador: cada Agente com "Conectar" ou "Desconectar" e o aviso de "Admin sem
  conectados" quando nenhum está conectado. "Conectar" põe a linha em "Conectando" e desabilita o
  botão até a resposta. `failure` mostra o toast "Não foi possível conectar o agente", e `forbidden`
  mostra "Só administradores conectam agentes".
- "Desconectar" abre o ConfirmDialog "Desconectar <nome>?", com o foco em "Cancelar". Confirmar mostra
  "Enviando". Na falha, a confirmação fecha e o toast diz "Não foi possível desconectar o agente".
- Para quem não administra: cada Agente com o estado e, abaixo, "Administradores", lido por
  `GET /api/people?admin=true` ao abrir, com UserAvatar, Presença, nome, `@usuário` e cargo. Clicar
  ou dar Enter abre o painel de perfil e fecha o diálogo. Sem administradores, mostra o texto de
  "Membro sem administradores".
- O texto exato de cada toast é conferido no Figma (PRD, "Antes da implementação").

**Menção a um Agente**

- **Autocompletar:** o `useMentionPicker` junta, depois dos Membros, os Agentes conectados cujo
  `name` ou `username` começa pelo que se digita, com o AgentAvatar. Escolher um insere
  `@<username>`.
- **Destaque:** o `splitMessageBody` recebe também os `username` dos Agentes conectados e reconhece
  `@<username>` com a mesma regra de limite de palavra das Menções gravadas. O segmento vira um
  `AgentMentionChip`, com o tom de Menção a outra Pessoa, que abre o diálogo "Agentes" ao clicar ou
  com Enter.
- A API do chat não grava Menção a Agente. A Menção a uma Pessoa continua vindo de `mentions`, e
  ganha da de um Agente se, por um erro de dados, os dois tiverem o mesmo `@usuário`.
- Com a lista indisponível, nenhum Agente aparece no autocompletar nem é destacado.

**Selo de administrador**

- O painel de perfil mostra o selo "Administrador" abaixo do `@usuário` quando o Perfil traz
  `isAdmin`, como no frame "Painel de perfil / Selo de administrador" (26:45404). O Perfil é lido a
  cada abertura, e por isso o selo acompanha o papel na abertura seguinte.

**Telas**, que reproduzem os frames do Figma (arquivo `slack`, página Telas):

- "Casca / Agentes": Admin sem nenhum conectado (25:21570), Admin com parte conectada (25:22334),
  Admin com todos conectados (25:23098) e Quem não administra (25:23870).
- "Diálogos / Agentes": Carregando (26:30181), Erro (26:30973), Vazio (26:31758), Admin sem
  conectados (26:32554), Admin com conectado (26:33348), Membro sem conectados (26:34140), Membro
  com conectado (26:34930), Membro sem administradores (151:43444) e Conectando (26:35730).
- "Diálogos / Desconectar agente": Padrão (26:36510) e Enviando (26:37294).
- "Painel de perfil / Selo de administrador" (26:45404).
- **Mudança no Figma, antes do código de cada tela**, pelo `docs/design-system.md` ("Do código para
  o Figma"), cada uma na tarefa da tela que a usa:
  - o erro ao conectar e ao desconectar;
  - o autocompletar com um Agente e o `AgentMentionChip` numa Mensagem;
  - a seção Agentes com a lista indisponível;
  - o frame do selo alinhado aos frames "Casca / Agentes" na linha do Agente e na ação da seção;
  - os frames desta lista no tema claro e no escuro, se faltarem.

### Ambiente de desenvolvimento

- O `compose.yaml` passa `AGENTS_SERVICE_URL` (`http://agents:8000`) e `AGENTS_SERVICE_TOKEN` à web,
  e `AGENTS_SERVICE_TOKEN`, `DATABASE_URL` e `ADK_DEV_ROUTES=true` ao `agents`. O segredo de
  desenvolvimento é um valor fixo do Compose.
- As migrações do Banco dos agentes rodam à mão no contêiner `agents`, como as da API do chat no
  dela (`apps/agents/AGENTS.md`).
- O e2e passa a exigir o Serviço de agentes de pé, junto da web e da API do chat.

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que aparece na tela), e não a forma interna. A forma de cada
teste da API do chat está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de ponta a ponta por HTTP com banco real:**

- `GET /v1/sessions/current` e `GET /v1/people/:id` trazem `is_admin`;
- `GET /v1/people?admin=true` traz só os administradores, com e sem `q`;
- `POST /v1/agents/changed` responde 204 a um administrador, 403 a quem não administra e 401 sem
  Sessão;
- perder o papel no banco faz a próxima chamada de `POST /v1/agents/changed` responder 403, com a
  mesma Sessão.

**API do chat, teste de ponta a ponta com o servidor real e `socket.io-client`:** o
`POST /v1/agents/changed` entrega `agents.changed` a todas as Pessoas conectadas, inclusive às
outras abas de quem pediu, e o evento não volta na reconexão com cursor.

**API do chat, testes de integração do comando de contas**, no arquivo que existe: `set-admin` dá e
tira o papel pelo e-mail e pelo `@usuário`, e diz "já era" sem mudar nada; `create-bot` cria o bot e
recusa formato inválido, `@usuário` de Pessoa e `@usuário` de outro bot; `create` recusa o
`@usuário` de um bot, informado ou derivado do e-mail.

**Banco, teste de ponta a ponta das migrações:** `is_admin` existe com `false` nas Pessoas que já
existem; `bots` recusa `username` repetido e fora do formato.

**Serviço de agentes, testes de unidade (`tests/unit`):** o catálogo monta um Agente por pasta com
`card.py`, com o `slug` igual ao nome da pasta, e falha com o nome da pasta quando falta o
`card.py`; a configuração falha com o nome da variável obrigatória ausente.

**Serviço de agentes, testes de integração (`tests/integration`), com o app real pelo `httpx` e o
banco `agents_test`:**

- o banco é apagado e criado de novo a cada execução, conectado como o superusuário local, e recebe
  as migrações, como o `chat_test` (LLD, "Ambiente de desenvolvimento");
- toda rota `/v1` responde 401 sem a credencial ou com a errada;
- `GET /v1/agents` traz o catálogo com `connected`;
- conectar e desconectar respondem 204 e mudam o `connected`, inclusive repetidos;
- `forbidden` sem `is_admin`, antes de `agent_not_found` com um `slug` fora do catálogo;
- uma linha de um `slug` fora do catálogo não aparece na lista;
- com `ADK_DEV_ROUTES` falso, `/run` e `/list-apps` respondem 404 e `/health` responde 200;
- esta suíte entra na "Verificação completa" do `apps/agents/AGENTS.md`.

**Web, Vitest para as funções puras:** a escolha da variante da seção Agentes (papel, estado e lista
indisponível); o `splitMessageBody` com Menções gravadas e `username` de Agentes, inclusive a
precedência da Pessoa e o limite de palavra; o filtro do autocompletar de Agentes.

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F10 junto dos testes. O papel de administrador é dado pelo comando de
contas na preparação do teste, e o Agente começa desconectado em cada teste que o conecta. Duas
Pessoas em dois contextos do navegador:

- o administrador conecta o `assistente` pelo diálogo, e a outra Pessoa vê a linha na barra lateral
  sem recarregar; o administrador desconecta pela confirmação, e a linha some para os dois;
- quem não administra abre "Ver agentes", vê o estado sem botões e a lista de administradores, e
  abre o perfil de um deles;
- com o Agente conectado, `@ass` no composer mostra o Agente no autocompletar, e a Mensagem enviada
  mostra o chip, que abre o diálogo; depois de desconectar, o chip vira texto comum para a outra
  Pessoa sem recarregar;
- o selo aparece no perfil do administrador;
- tudo pelo teclado, e a checagem de acessibilidade com `@axe-core/playwright` no diálogo "Agentes",
  na confirmação e no painel de perfil com o selo, nos dois temas, sem violações.

**Medição:** o p95 de 1 s dos critérios de "Todas as histórias" segue o caminho medido para o
`message.created` na F03: o `agents.changed` sai pela mesma publicação na sala `workspace`, sem
gravação no Redis, seguido de uma leitura pelo BFF. Não há medição nova.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois
temas, comparada com o `get_screenshot` dos frames citados (`docs/design-system.md`, "Validação
visual"), registrada na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse nos dois temas, com o diálogo "Agentes" aberto como administrador e como quem não
administra.

**Exemplos anteriores:** os testes da F09 (eventos na sala `workspace`, retrato na reconexão, painel
de perfil) e os do comando de contas da F05; no Serviço de agentes, `tests/integration/
test_server_e2e.py`.

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- Credencial de bot, identificador de pedido e qualquer chamada do Serviço de agentes à API do chat:
  F11.
- Usar o bot como autor de Mensagem: F11.
- Publicar evento nas mudanças feitas pelo comando de contas.
- Reenvio do `agents.changed` na reconexão: a releitura da lista na conexão cobre o evento perdido.
- O snapshot OpenAPI das rotas novas, que segue planejado no LLD, nos dois projetos.

## Observações

- O glossário ganhou "Administrador".
- O LLD foi atualizado nas seções "Estrutura do código" (pastas e bibliotecas do projeto `agents`),
  "Componentes e dependências", "Segurança" (credencial de serviço), "Dados", "Interfaces" (rotas e
  evento), "Cliente", "Valores e configuração" (variáveis), "Ambiente de desenvolvimento",
  "Decisões" e "Questões em aberto". O HLD não muda: o registro no Serviço de agentes, a credencial
  de serviço do BFF e o papel enviado pelo BFF já estão nele.
- [ADR 0028](../../adr/0028-bots-numa-tabela-propria.md): bots numa tabela própria no Banco do chat.
- Os nós do Figma citados vieram do levantamento feito para esta spec e podem mudar de id se os
  frames forem recriados. Nesse caso, valem os nomes.
