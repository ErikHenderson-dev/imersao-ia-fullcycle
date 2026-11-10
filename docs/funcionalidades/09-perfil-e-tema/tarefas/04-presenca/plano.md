# Plano da F09-T04: Presença

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas) e encontra a seção "Presença
(F09)", com a bolinha de Presença no autor da Mensagem, em "Membros de #nome", nos resultados de
"Nova conversa" e no cabeçalho da Conversa direta, nos temas claro e escuro.

### CA2

**Marca:** teste de ponta a ponta da API

**Cenário:** A migração acrescenta `presence_choice`, com `available` por padrão e CHECK;
`PUT /v1/people/me/presence` grava a escolha (204), recusa valor fora da lista com
`validation_failed` (400) e, sem Sessão, 401; a mesma escolha de novo não publica.

**Teste previsto:** `test/people-presence.e2e-spec.ts` e `test/database.e2e-spec.ts`.

### CA3

**Marca:** teste de unidade

**Cenário:** O rastreador de presença, com timers falsos: a primeira conexão deixa disponível quem
escolheu disponível; a segunda aba não publica; fechar uma de duas abas não muda nada; fechar a
última só deixa ausente depois da carência; reconectar dentro da carência não publica; trocar a
escolha com a Pessoa conectada publica, e desconectada não publica. `PRESENCE_GRACE_MS` entra no
schema das variáveis, com o padrão de 30000.

**Teste previsto:** `src/realtime/presence-tracker.spec.ts` e `src/config/env.schema.spec.ts` (se
existir; senão, o caso entra no teste de inicialização).

### CA4

**Marca:** teste de ponta a ponta da API

**Cenário:** Toda mudança da Presença calculada publica `presence.changed` (`person_id`,
`presence`) para a sala `workspace`, sem guardar nem reenviar. A Presença vai no retrato (quem está
disponível ou tem Status), no Perfil, na busca e nos Membros; a escolha, em
`GET /v1/sessions/current`.

**Teste previsto:** `test/realtime-presence.e2e-spec.ts` e `test/people-presence.e2e-spec.ts`, com
a carência reduzida por `PRESENCE_GRACE_MS` no teste.

### CA5

**Marca:** teste no Playwright

**Cenário:** O menu do avatar mostra a Presença no cabeçalho ("Disponível" ou "Ausente") e "Definir
como ausente" ou "Definir como disponível"; a escolha muda na hora e, na falha da Server Action,
volta à anterior com o toast "Não foi possível mudar a presença".

**Teste previsto:** Playwright, `e2e/perfil/presenca.spec.ts`, "define como ausente e disponível
pelo menu" e "a falha volta à presença anterior".

### CA6

**Marca:** teste de unidade

**Cenário:** A camada de Pessoas aplica o `presence.changed` e o retrato: quem está no retrato como
disponível fica disponível; quem não está, ausente; o evento troca a Presença da Pessoa.

**Teste previsto:** Vitest, `src/app/utils/people-store.test.ts`.

### CA7

**Marca:** teste no Playwright

**Cenário:** Duas Pessoas em dois contextos: "Definir como ausente" troca a bolinha da outra para
ausente sem recarregar, no autor da Mensagem, na barra lateral e no perfil; fechar o contexto da
Pessoa a deixa ausente para a outra depois da carência. O menu, pelo teclado, e o axe no menu, nos
dois temas, sem violações.

**Teste previsto:** Playwright, `e2e/perfil/presenca.spec.ts`, "a outra Pessoa vê a Presença
mudar" e "fechar todas as abas deixa ausente", e `e2e/acessibilidade/presenca-sem-violacoes.spec.ts`.

### CA8

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra o menu (Disponível e
Ausente), o painel de perfil e os lugares com a bolinha, nos dois temas, ao lado dos frames; e
`roteiro-manual.md`, com a nota 100 de Acessibilidade do Lighthouse na Conversa com o painel de
perfil aberto e com o diálogo aberto, nos dois temas.

## Contrato

### people · chat · alterada

- `presence_choice`: texto, obrigatório, padrão `'available'`, CHECK
  `presence_choice IN ('available', 'away')`, escrito à mão na migração.

### `PUT /v1/people/me/presence` · nova

- Autenticação: Sessão. Corpo: `presence_choice` (`available` ou `away`), obrigatório.
- Sucesso: 204. Erros: `validation_failed` (400), `unauthenticated` (401).

### `GET /v1/people/presence` · alterada

- Antes: `people` com `{ id, status }` de quem tem Status. Depois: `{ id, presence, status }` de quem
  está disponível ou tem Status.

### `GET /v1/people/:id`, `GET /v1/people`, `GET /v1/conversations/:id/members` · alteradas

- Cada Pessoa ganha `presence` (`available` ou `away`).

### `GET /v1/sessions/current` · alterada

- A Pessoa ganha `presence_choice`.

### `presence.changed` · servidor → cliente · novo

| Item | O que descreve |
| --- | --- |
| Quem recebe | A sala `workspace` |
| Autenticação | A do handshake |
| Carga | `person_id` (texto) e `presence` (`available` ou `away`) |
| Confirmação | Nenhuma |
| Erros | Nenhum; a falha só fica em log |

Não entra em `StoredEventPayloads`.

### Variável `PRESENCE_GRACE_MS` · nova

- API do chat, número inteiro positivo, padrão 30000 (LLD, "Carência da presença").

## Verificação do contrato

- Coluna e CHECK, rota de escolha: CA2.
- Rastreador, carência e variável: CA3.
- `presence.changed`, retrato, Perfil, busca, Membros e Sessão: CA4.

## Decisões

- **Rastreador.** `PresenceTracker`, provider do módulo `realtime`, com o mapa de sockets por Pessoa,
  os timers de carência e o conjunto dos conectados; o gateway chama `connected` e `disconnected`
  (o `handleDisconnect` novo). Ele lê a escolha da Pessoa do `socket.data.person` na conexão e
  recebe a troca de escolha do controller.
- **Presença calculada.** `available` quando conectada e com a escolha `available`; `away` em
  qualquer outro caso. O tracker publica `presence.changed` quando ela muda.
- **Leitura da Presença nas rotas.** O controller e os services consultam
  `PresenceTracker.presenceOf(id)`; o retrato junta quem tem Status (banco) e quem está disponível
  (tracker).
- **Web.** A camada de Pessoas guarda a Presença à parte, como o Status; o `PresenceDot` lê
  `useKnownPresence`. O `PersonAvatar` ganha a prop `presence` (com o `backdrop`), e os lugares da
  spec a ligam. O menu do avatar ganha a linha e o item da escolha, com a Server Action
  `savePresenceChoice`.
- **Carência no Playwright.** O teste de fechar o contexto espera a carência real (30 s, mais o
  ping), com o tempo do teste aumentado; a carência reduzida fica para a API.

## Arquivos e interfaces

- **API:** migração `AddPersonPresenceChoice`; `person.entity.ts`, `env.schema.ts`,
  `realtime/presence-tracker.ts`, `realtime.gateway.ts`, `realtime.publisher.ts`,
  `profiles.controller.ts`, `memberships`, `conversations` (Membros), `sessions/person.response.ts`;
  `chat-events` (`PresenceChangedEvent`).
- **Web:** `utils/people-store.ts`, `components/people/` (`PresenceDot`, `PersonAvatar`),
  `actions/save-presence-choice.ts`, `services/chat-api.ts`, `components/user/user-menu.tsx` e os
  lugares de Pessoa.

## Testes existentes que mudam

- Os que comparam o formato exato da Pessoa (Sessão, Perfil, busca, Membros) ganham `presence` ou
  `presence_choice`.
- `test/people-status.e2e-spec.ts`: o retrato ganha `presence`.

## Mudança de dados

A coluna nova, com o padrão `available` para quem já existe.

## Documentos atualizados

Nenhum no commit de plano; na entrega, o LLD passa a Presença (6.4), as rotas, o evento e a
variável a `existe`.
