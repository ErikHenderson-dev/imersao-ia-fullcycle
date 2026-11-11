# Plano da F10-T08: Mudança de conexão em tempo real

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:**
- Dado um administrador com Sessão, quando ele chama `POST /v1/agents/changed`, então recebe 204.
- Dada uma Pessoa que não administra, então 403 `forbidden`.
- Dado um administrador que perdeu o papel no banco, com a mesma Sessão, então 403 `forbidden`.
- Sem Sessão, 401 `unauthenticated`.

**Teste previsto:** e2e da API, `test/agents-changed.e2e-spec.ts`.

### CA2

**Marca:** teste HTTP

**Cenário:**
- Dadas duas Pessoas conectadas, uma delas com duas abas, quando um administrador chama
  `POST /v1/agents/changed`, então as três abas e a aba do próprio administrador recebem
  `agents.changed`, sem carga.
- Dada uma aba que caiu e volta com o cursor do último `sync`, quando o evento saiu durante a
  queda, então ele não chega no reenvio.

**Teste previsto:** e2e da API com `socket.io-client`, `test/realtime-agents.e2e-spec.ts`.

### CA3

**Marca:** revisão humana

**Cenário:** Quem revisa abre `actions/agent-connection.ts` e encontra, depois do `ok` do Serviço
de agentes, a chamada a `POST /v1/agents/changed` com o cookie (pelo `chat-api.ts`), e a falha dela
só no log (`console.error`), com a ação devolvendo `ok`. O efeito do sucesso é provado na CA5.

### CA4

**Marca:** teste no Playwright

**Cenário:** O cliente relê a lista no `agents.changed` e a cada conexão e reconexão do socket: dado
um Agente conectado direto no Banco dos agentes, sem evento, quando a aba cai e volta (o
`offline` do navegador), então a linha aparece sem recarregar.

**Teste previsto:** Playwright, `e2e/agentes/tempo-real.spec.ts`, "a reconexão relê a lista".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dadas duas Pessoas em dois contextos, a outra com o diálogo "Agentes" aberto, quando o
administrador conecta o `assistente`, então a outra vê a linha aparecer na barra lateral e o
diálogo dela passar a "Conectado", sem recarregar; quando ele desconecta, a linha some e o diálogo
volta a "Não conectado".

**Teste previsto:** Playwright, `e2e/agentes/tempo-real.spec.ts`, "a outra Pessoa vê a mudança sem
recarregar".

### CA6

**Marca:** documento

**Cenário:** A 09 ainda não está concluída: o cenário do chip virando texto comum sem recarregar
fica com a 09 (CA7 dela), como diz este critério. Quem revisa encontra a nota no plano de testes da
F10.

## Contrato

### `POST /v1/agents/changed` · nova

- Autenticação: Sessão (cookie).
- Corpo: nenhum.
- Resposta de sucesso: 204, sem corpo.
- Erros: 401 `unauthenticated`; 403 `forbidden` sem `is_admin`.

### `agents.changed` · servidor → cliente · novo

- Quem recebe: a sala `workspace`, inclusive as abas de quem pediu.
- Autenticação: a da conexão.
- Carga: nenhuma.
- Confirmação: nenhuma.
- Erros: nenhum. Sem cursor, sem guardar nos eventos por Pessoa e sem reenvio na reconexão.

## Verificação do contrato

- `POST /v1/agents/changed` 204, 403 (inclusive depois de perder o papel) e 401: CA1.
- `agents.changed` na sala `workspace` e fora do reenvio: CA2.

## Decisões

- **Erro `forbidden`.** Um `code` novo, `forbidden` (403), no `ErrorCode` e no mapa do filter, com
  `NotAdminError` no módulo `agents`.
- **Módulo `agents`.** `AgentsController` (`POST /v1/agents/changed`, 204) e `AgentsService`
  (`announceChange(person)`), que confere `person.isAdmin` (a Pessoa que o guard carregou do banco
  nesta requisição) e chama `RealtimePublisher.agentsChanged()`.
- **Publicação.** `agentsChanged()` emite `agents.changed` sem carga na sala `workspace`, como o
  `personUpdated` da F09, sem derrubar a requisição numa falha.
- **Contrato.** `"agents.changed": () => void` em `ServerToClientEvents` do `packages/chat-events`,
  fora dos eventos guardados. A mudança pede `pnpm install --frozen-lockfile` nos contêineres
  `chat-api` e `web`, porque o pacote entra copiado.
- **Cliente.** O `RealtimeProvider` repassa o evento aos listeners (`onAgentsChanged`). O
  `AgentsProvider` assina e relê a lista; e relê a cada `connected` do socket (a primeira conexão e
  cada volta), junto do retrato de Presença da F09.
- **Server Actions.** `announceAgentsChanged(token)` no `chat-api.ts`; `changeConnection` o chama
  depois do `ok` e registra a falha com `console.error`, devolvendo `ok`.

## Arquivos e interfaces

- `packages/chat-events/index.d.ts`: `agents.changed`.
- `apps/chat-api/src/common/errors/error-code.ts`: `forbidden`.
- `apps/chat-api/src/agents/agents.module.ts`, `agents.controller.ts`, `agents.service.ts`,
  `not-admin.error.ts`: novos; `src/app.module.ts` importa o módulo.
- `apps/chat-api/src/realtime/realtime.publisher.ts`: `agentsChanged()`.
- `apps/chat-api/test/agents-changed.e2e-spec.ts` e `test/realtime-agents.e2e-spec.ts`: novos.
- `apps/web/src/app/components/realtime/realtime-provider.tsx`: `onAgentsChanged`.
- `apps/web/src/app/components/agent/agents-provider.tsx`: as releituras.
- `apps/web/src/app/services/chat-api.ts`: `announceAgentsChanged`.
- `apps/web/src/app/actions/agent-connection.ts`: o aviso depois do sucesso.
- `apps/web/e2e/agentes/tempo-real.spec.ts` e o plano de testes.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra a rota e o evento como planejados.
