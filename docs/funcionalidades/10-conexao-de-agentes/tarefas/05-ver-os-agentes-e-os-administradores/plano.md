# Plano da F10-T05: Ver os Agentes e os administradores

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas, seção "Casca") e encontra
"Casca / Agentes / Lista indisponível, quem não administra" e "Casca / Agentes / Lista
indisponível, admin", nos temas claro e escuro, com a seção Agentes sem linhas e só "Ver agentes"
ou "Gerenciar agentes"; e o frame "Painel de perfil / Selo de administrador" com a seção Agentes
igual à dos frames "Casca / Agentes": a linha do Agente só com o AgentAvatar e o nome, sem o
`@usuário` ao lado. As linhas de Agente dos frames "Casca / Agentes" mostram o `name` do catálogo
("Assistente"), como diz a spec ("Seção Agentes da barra lateral").

### CA2

**Marca:** teste HTTP

**Cenário:**
- Dadas duas administradoras e uma Pessoa que não administra, com o mesmo marcador no nome,
  quando alguém chama `GET /v1/people?admin=true&q=<marcador>`, então vêm só as duas, em ordem de
  nome, com o que a busca já traz.
- Sem `q`, `admin=true` traz administradores e nenhuma Pessoa que não administra, até 20.
- `admin` com outro valor responde 400 `validation_failed`.

**Teste previsto:** e2e da API, `test/people-search.e2e-spec.ts`, bloco "admin=true".

### CA3

**Marca:** teste no Playwright

**Cenário:**
- Dada uma Pessoa logada, quando a página chama `GET /api/agents`, então recebe o catálogo do
  Serviço de agentes, com o `Assistente`.
- Dada a mesma rota sem Sessão, então responde 401.
- Dado o Serviço de agentes fora, então a rota responde 502 com `{ kind: "agents_unavailable" }`:
  conferido com o Uvicorn parado, na mesma rodada da validação visual da lista indisponível, e
  registrado em `validacao-visual.md` (o e2e roda com o Serviço de agentes de pé, e pará-lo no
  meio da suíte derrubaria os outros testes).

**Teste previsto:** Playwright, `e2e/agentes/ver-agentes.spec.ts`, "GET /api/agents exige Sessão
e traz o catálogo".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dada uma Pessoa que não administra, com o `assistente` conectado no Banco dos agentes,
quando ela carrega o chat, então a seção Agentes, depois de "Mensagens diretas", mostra a linha
"Assistente" com o AgentAvatar e a ação "Ver agentes"; com o `assistente` desconectado, só "Ver
agentes". O layout com o Serviço de agentes fora (lista indisponível, só "Ver agentes") é
conferido na validação visual (CA8), com o Uvicorn parado, e a escolha da variante pelo Vitest
(CA7).

**Teste previsto:** Playwright, `e2e/agentes/ver-agentes.spec.ts`, "a seção mostra os conectados
e Ver agentes".

### CA5

**Marca:** teste no Playwright

**Cenário:**
- **Lista e administradores:** "Ver agentes" e a linha do Agente abrem o diálogo "Agentes", que
  mostra cada Agente com o nome, o `@usuário`, a descrição e o estado ("Conectado" ou "Não
  conectado"), sem botão; o aviso de "Membro sem conectados" quando nenhum está conectado; e
  "Administradores", com a administradora do teste (avatar, nome, `@usuário` e cargo).
- **Perfil:** Enter na administradora fecha o diálogo e abre o painel de perfil dela.
- **Estados**, com as rotas do BFF trocadas no navegador: Carregando enquanto `GET /api/agents` não
  responde; Erro com "Tentar de novo", que lê de novo e mostra a lista; Vazio com o catálogo vazio;
  "Membro sem administradores" com a lista de administradores vazia.

**Teste previsto:** Playwright, `e2e/agentes/ver-agentes.spec.ts`, "quem não administra vê os
Agentes e os administradores e abre um perfil pelo teclado" e "os estados do diálogo".

### CA6

**Marca:** teste no Playwright

**Cenário:** O e2e exige o Serviço de agentes de pé: o `compose.yaml` passa ao `e2e` o
`AGENTS_DATABASE_URL`, o guia do e2e o lista entre os serviços necessários, e os testes que
dependem do estado de conexão o gravam no Banco dos agentes sob uma trava (`pg_advisory_lock`),
para dois testes em paralelo não mudarem o estado um do outro. Todo o fluxo da CA5 é feito pelo
teclado. O axe no diálogo de quem não administra, nos dois temas, não acha violações.

**Teste previsto:** Playwright, `e2e/agentes/ver-agentes.spec.ts` e
`e2e/acessibilidade/agentes-sem-violacoes.spec.ts`.

### CA7

**Marca:** teste de unidade

**Cenário:** `agentsSectionView` devolve, para quem não administra, os conectados em ordem e a ação
`view`; para a lista indisponível (`null`), nenhuma linha e `view` (ou `manage`, para o
administrador). Para o administrador, até a 06, a mesma `view` com os conectados.

**Teste previsto:** Vitest, `src/app/utils/agents-section.test.ts`.

### CA8

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra a seção Agentes de
quem não administra (com conectado, sem conectado e lista indisponível) e o diálogo nos estados
Carregando, Erro, Vazio, Membro sem conectados, Membro com conectado e Membro sem administradores,
nos dois temas, ao lado dos frames.

## Contrato

### `GET /v1/people` · alterada

- Parâmetros de consulta: ganha `admin`, opcional, só o valor `true`; com ele, só os
  administradores, combinável com `q`, até o limite da busca, em ordem de nome.
- Erros: `validation_failed` (400) também para `admin` com outro valor.

### `GET /api/agents` (BFF) · nova

- Autenticação: o cookie de Sessão, conferido em `GET /v1/sessions/current`.
- Chama `GET /v1/agents` do Serviço de agentes com `Authorization: Bearer
  <AGENTS_SERVICE_TOKEN>`.
- Resposta de sucesso: 200, `Agent[]` (`slug`, `name`, `username`, `description`, `connected`).
- Erros: 401 `{ kind: "unauthenticated" }` sem Sessão; 502 `{ kind: "agents_unavailable" }` na
  falha do Serviço de agentes; 502 `{ kind: "failure" }` na falha da API do chat. O formato
  `{ kind }` segue as outras rotas do BFF.

### `GET /api/people` (BFF) · alterada

- Repassa `admin=true` à API.

## Verificação do contrato

- `GET /v1/people?admin=true`, com e sem `q`, e o 400: CA2.
- `GET /api/agents` 200, 401 e 502 `agents_unavailable`: CA3.
- `GET /api/people?admin=true`: CA5.

## Decisões

- **Cliente do Serviço de agentes.** `src/app/services/agents-service.ts`, no padrão do
  `chat-api.ts`: `fetch` sem cache, o mesmo tempo limite, `AGENTS_SERVICE_URL` e
  `AGENTS_SERVICE_TOKEN` do `config/env.ts`, e `listAgents()` devolvendo `{ kind: "ok", agents }` ou
  `{ kind: "failure" }`, sem lançar. O tipo `Agent` mora nele.
- **Lista no cliente.** `AgentsProvider` (cliente) guarda um `useSWR` com a chave `AGENTS_KEY =
  "/api/agents"` e o `fallbackData` do layout (só quando a leitura do servidor deu certo), sem
  revalidar sozinho no foco nem na montagem. `useAgents()` devolve `{ agents: Agent[] | null,
  error, isValidating, reload }`, em que `null` é a lista indisponível. Os pontos de releitura
  desta tarefa: a abertura do diálogo e o "Tentar de novo". O `agents.changed` e a conexão do
  socket entram com a 08, e a releitura depois de conectar e desconectar com a 06 e a 07.
- **Layout.** O `AuthenticatedShell` lê `listAgents()` junto da Pessoa da Sessão e passa o
  resultado ao `AgentsProvider`; a falha não impede o layout. A Sidebar ganha `isAdmin`.
- **Variante da seção.** `agentsSectionView({ isAdmin, agents })`, em
  `src/app/utils/agents-section.ts`, devolve `{ rows, action, count }`. Nesta tarefa, sem as
  variantes de administrador, que são da 06: o administrador recebe `view`, ou `manage` com a lista
  indisponível, como na tabela da spec.
- **Seção e diálogo.** `AgentsSection` (cliente), em
  `src/app/components/agent/agents-section.tsx`, com um `SidebarSection` "Agentes": cada linha é um
  botão com o AgentAvatar e o nome, que abre o diálogo, e a ação é o `SidebarAction` da variante. O
  diálogo, `AgentsDialog` em `components/agent/agents-dialog.tsx`, é um `Dialog` controlado, com o
  conteúdo montado a cada abertura. Ele mostra o cache enquanto revalida; sem dados, Carregando
  (três blocos `surface-inset`, como no frame); na falha da revalidação, Erro com "Tentar de
  novo"; com o catálogo vazio, o EmptyState de "Vazio".
- **Administradores no diálogo.** `useSWR("/api/people?admin=true")`, lido a cada abertura, com o
  `PersonRow` dentro de um botão, como nos Membros. Escolher um abre o perfil pelo
  `useOpenProfileFromOverlay`, que fecha o diálogo e leva o foco ao painel.
- **AgentAvatar.** `src/app/components/agent/agent-avatar.tsx`, com os tamanhos do componente do
  Figma usados aqui: `xs` (20, na barra lateral, sobre `sidebar-field`) e `md` (36, no diálogo,
  sobre `sidebar`), com o `Bot` de 12 e 20 px.
- **Estado de conexão nos testes da web.** `e2e/support/agents.ts` abre um `pg.Pool` no
  `AGENTS_DATABASE_URL`, com `setConnected(slug, connected)` e o fixture `agentsLock`, que segura um
  `pg_advisory_lock` durante o teste. Os testes que leem ou mudam o estado do `assistente` usam o
  fixture.
- **Administradores nos testes da web.** Os testes que dão o papel o tiram no fim
  (`setAdminOf(..., false)` no fixture), para a lista de administradores do banco de
  desenvolvimento não crescer a cada execução e passar do limite de 20; os testes da 02 passam a
  fazer o mesmo.
- **Segredo da web.** `AGENTS_SERVICE_URL: http://agents:8000` e `AGENTS_SERVICE_TOKEN:
  dev-agents-service-token` no serviço `web` do `compose.yaml`.

## Arquivos e interfaces

- `apps/chat-api/src/memberships/search-people.query.ts`, `memberships.controller.ts`,
  `memberships.service.ts` e `src/people/people.service.ts` (`search` com `onlyAdmins`).
- `apps/chat-api/test/people-search.e2e-spec.ts`: bloco novo.
- `apps/web/src/app/config/env.ts`: `AGENTS_SERVICE_URL`, `AGENTS_SERVICE_TOKEN`.
- `apps/web/src/app/services/agents-service.ts`: `Agent`, `listAgents()`.
- `apps/web/src/app/services/chat-api.ts`: `searchPeople` com `admin`.
- `apps/web/src/app/api/agents/route.ts`: nova; `api/people/route.ts`: repassa `admin`.
- `apps/web/src/app/components/agent/agents-provider.tsx`, `agent-avatar.tsx`,
  `agents-section.tsx`, `agents-dialog.tsx`: novos.
- `apps/web/src/app/utils/agents-section.ts` (+ teste): `agentsSectionView`.
- `apps/web/src/app/(app)/layout.tsx` e `components/workspace-nav/sidebar.tsx`.
- `apps/web/e2e/support/agents.ts`, `e2e/agentes/ver-agentes.spec.ts`,
  `e2e/acessibilidade/agentes-sem-violacoes.spec.ts`, `e2e/plano-de-testes-f10.md`, e o fixture de
  administrador em `e2e/fixtures.ts`.
- `compose.yaml` (`web` e `e2e`) e `apps/web/AGENTS.md` (o e2e exige o Serviço de agentes).

## Testes existentes que mudam

- `e2e/perfil/selo-de-administrador.spec.ts` e `e2e/acessibilidade/selo-de-administrador-sem-violacoes.spec.ts`:
  tiram o papel no fim, pelo fixture novo.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: a spec e o LLD já registram a rota, o filtro e o cliente como
planejados.
