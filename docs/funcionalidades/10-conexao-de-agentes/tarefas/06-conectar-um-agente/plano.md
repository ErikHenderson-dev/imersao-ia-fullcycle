# Plano da F10-T06: Conectar um Agente

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas, seção "Diálogos da casca") e
encontra "Diálogos / Agentes / Erro ao conectar" e "Diálogos / Agentes / Sem papel ao conectar",
cada um com o diálogo do administrador e o Toast de erro ("Não foi possível conectar o agente" e
"Só administradores conectam agentes"), nos temas claro e escuro.

### CA2

**Marca:** teste de integração

**Cenário:**
- `PUT /v1/agents/assistente/connection` com `person_id` e `is_admin: true` responde 204 e deixa o
  `assistente` conectado em `GET /v1/agents`; repetido, responde 204 e o `connected_by` continua o
  da primeira Pessoa.
- Sem a credencial, 401 `unauthorized`, antes de olhar o corpo.
- Com `is_admin: false`, 403 `forbidden`, também com um `slug` fora do catálogo.
- Com um `slug` fora do catálogo e `is_admin: true`, 404 `agent_not_found`.
- Sem `person_id`, com `person_id` que não é UUID ou sem `is_admin`, 400 `validation_failed`.

**Teste previsto:** integração, `tests/integration/test_connection_routes.py`.

### CA3

**Marca:** teste no Playwright

**Cenário:**
- Dado um administrador que perdeu o papel no banco com a tela aberta, quando ele clica em
  "Conectar", então vê o toast "Só administradores conectam agentes", e o `assistente` continua
  desconectado no Banco dos agentes (a ação devolveu `forbidden` sem chamar o Serviço de agentes:
  o estado não muda).
- Dado o Serviço de agentes respondendo com falha (a Server Action trocada no navegador para
  devolver `failure`), então o toast "Não foi possível conectar o agente" aparece e o Agente
  continua desconectado no diálogo.

**Teste previsto:** Playwright, `e2e/agentes/conectar-agente.spec.ts`, "quem perdeu o papel recebe
o erro" e "a falha mostra o erro e não muda nada".

### CA4

**Marca:** teste de unidade

**Cenário:** `agentsSectionView` devolve ao administrador `connect` com o número de desconectados
quando nenhum está conectado; os conectados e `add` quando parte está; os conectados e `manage`
quando todos estão; `manage` com o catálogo vazio. A linha e a ação abrem o diálogo (provado no
Playwright da CA6).

**Teste previsto:** Vitest, `src/app/utils/agents-section.test.ts`.

### CA5

**Marca:** teste no Playwright

**Cenário:** O diálogo do administrador mostra o aviso de "Admin sem conectados" e "Conectar" no
`assistente` desconectado; "Conectar" fica desabilitado com o spinner ("Conectando") até a
resposta e termina com "Desconectar" na linha; a seção passa a mostrar a linha do `assistente`.

**Teste previsto:** Playwright, `e2e/agentes/conectar-agente.spec.ts`, "o administrador conecta o
assistente pelo teclado".

### CA6

**Marca:** teste no Playwright

**Cenário:**
- Dados um administrador e outra Pessoa logados, com o `assistente` desconectado, quando o
  administrador abre "Conectar agentes" (com o contador 1) pelo teclado e conecta, então a seção
  dele passa a "Gerenciar agentes" com a linha; a outra Pessoa, ao recarregar, vê a linha.
- O axe no diálogo do administrador, nos dois temas, não acha violações.

**Teste previsto:** Playwright, `e2e/agentes/conectar-agente.spec.ts` e
`e2e/acessibilidade/agentes-admin-sem-violacoes.spec.ts`.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra a seção do
administrador (sem nenhum conectado, com todos conectados) e o diálogo (Admin sem conectados, Admin
com conectado, Conectando e o erro), nos dois temas, ao lado dos frames. "Admin com parte
conectada" não tem como aparecer com um catálogo de um Agente só, e é provado pelo Vitest (CA4).

## Contrato

### `PUT /v1/agents/{slug}/connection` · nova

- Autenticação: `Authorization: Bearer <AGENTS_SERVICE_TOKEN>`.
- Parâmetros de caminho: `slug`, texto.
- Corpo: `{ "person_id": UUID, "is_admin": boolean }`, os dois obrigatórios.
- Resposta de sucesso: 204, sem corpo, inclusive se já estava conectado.
- Erros, nesta ordem: 401 `unauthorized`; 403 `forbidden` sem `is_admin`; 404 `agent_not_found` fora
  do catálogo; 400 `validation_failed` com o corpo inválido (conferido antes do papel, porque sem
  corpo válido não há `is_admin` a conferir).

### Server Action `connectAgent(slug)` (BFF) · nova

- Lê a Pessoa da Sessão em `GET /v1/sessions/current`, sem cache.
- Sem Sessão: `unauthenticated`. Sem `is_admin`: `forbidden`, sem chamar o Serviço de agentes.
- Chama `PUT /v1/agents/{slug}/connection` com `person_id` e `is_admin`.
- Devolve `{ kind: "ok" } | { kind: "unauthenticated" } | { kind: "failure" } | { kind:
  "forbidden" }`; `agent_not_found`, um 403 do Serviço de agentes e qualquer outra falha viram
  `failure`.

## Verificação do contrato

- `PUT` 204, repetido, e o `connected_by` mantido: CA2.
- 401, 403 antes de 404, 404 e 400: CA2.
- `connectAgent`: `forbidden` sem chamar o Serviço de agentes e `failure`: CA3; `ok`: CA5 e CA6.

## Decisões

- **Ordem das conferências.** A credencial vem da dependência do router (401). O corpo é validado
  pelo FastAPI e o `RequestValidationError` vira `validation_failed` (400) pelo handler de
  problemas, que ganha esse caso. Depois, o service da rota confere `is_admin` (403) e só então o
  catálogo (404), para quem não administra não descobrir o catálogo pela resposta.
- **Conectar é idempotente no banco.** `connect(engine, slug, person_id)` faz `INSERT … ON CONFLICT
  (slug) DO NOTHING`, e o `connected_by` da primeira conexão fica.
- **União da Server Action.** `ConnectionResult` em `actions/agent-connection.ts`, que a 07 reusa.
  O módulo exporta `connectAgent(slug)`; a 07 acrescenta `disconnectAgent(slug)` no mesmo arquivo.
  A chamada ao Serviço de agentes fica em `services/agents-service.ts` (`setConnection(slug,
  connected, person)`), como manda o `apps/web/AGENTS.md` ("API Externas").
- **Releitura depois de conectar.** Com `ok`, o cliente chama o `reload()` da lista, e a linha
  aparece na barra lateral e no diálogo pela releitura. Com `unauthenticated`, leva a "Entrar".
- **Diálogo do administrador.** A descrição de administrador ("Conecte um agente ao workspace e
  mencione-o com @ em qualquer conversa."), o aviso de "Admin sem conectados" e, em cada linha,
  "Conectar" (Button `primary`, `sm`, com `loading` enquanto conecta) ou "Desconectar" (Button
  `secondary`, `sm`, que a 07 liga à confirmação). A linha em conexão guarda o estado local e não
  aceita outro clique.
- **Variantes de administrador.** `agentsSectionView` completa a tabela da spec: `connect` com o
  número de desconectados como `count` e "N desconectados" como texto acessível do contador, `add`,
  `manage`, e `manage` também com o catálogo vazio.
- **Teste da falha.** A falha do Serviço de agentes é provocada pela Server Action trocada no
  navegador (`routeServerAction`, que responde como o Next com `failure`), como nos testes de falha
  das outras tarefas; parar o Serviço de agentes derrubaria os outros testes.

## Arquivos e interfaces

- `apps/agents/app/problems.py`: o handler de `RequestValidationError`.
- `apps/agents/app/registry/store.py`: `connect(engine, slug, person_id)`.
- `apps/agents/app/registry/routes.py`: `PUT /v1/agents/{slug}/connection`, `ConnectionRequest`.
- `apps/agents/tests/integration/test_connection_routes.py`: novo.
- `apps/web/src/app/services/agents-service.ts`: `setConnection`.
- `apps/web/src/app/actions/agent-connection.ts`: `ConnectionResult`, `connectAgent`.
- `apps/web/src/app/utils/agents-section.ts` (+ teste): as variantes de administrador.
- `apps/web/src/app/components/agent/agents-dialog.tsx` e `agents-section.tsx`: a visão do
  administrador.
- `apps/web/e2e/agentes/conectar-agente.spec.ts`,
  `apps/web/e2e/acessibilidade/agentes-admin-sem-violacoes.spec.ts` e o plano de testes da F10.

## Testes existentes que mudam

- `src/app/utils/agents-section.test.ts`: o caso do administrador com a lista passa a esperar as
  variantes de administrador.
- `e2e/agentes/ver-agentes.spec.ts`: nenhum; a Pessoa dele não administra.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: a spec e o LLD já registram a rota e a Server Action como planejadas.
