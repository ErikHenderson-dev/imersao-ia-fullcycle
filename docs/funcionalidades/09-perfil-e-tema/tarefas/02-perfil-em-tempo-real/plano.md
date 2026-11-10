# Plano da F09-T02: Perfil em tempo real

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de ponta a ponta da API

**Cenário:** Dadas duas Pessoas conectadas, sem nenhuma Conversa em comum, quando uma delas salva
o Perfil, então a outra recebe o `person.updated`: a sala `workspace` alcança todo socket desde o
handshake.

**Teste previsto:** e2e da API, `test/realtime-people.e2e-spec.ts`, "o person.updated chega a
quem não divide Conversa".

### CA2

**Marca:** teste de ponta a ponta da API

**Cenário:**
- **Publica:** a edição que muda o nome, o `@usuário` ou o cargo entrega `person.updated` com
  `id`, `name`, `username` e `title` às outras Pessoas e às outras abas de quem editou.
- **Não publica:** a edição sem mudança, ou que só muda o telefone, não entrega nada.
- **Sem reenvio:** o evento não volta na reconexão com cursor.

**Teste previsto:** `test/realtime-people.e2e-spec.ts`, "publica a mudança a todas as abas",
"não publica sem mudança" e "não volta na reconexão".

### CA3

**Marca:** teste de ponta a ponta da API

**Cenário:** Dada uma Pessoa com a Conversa aberta, quando ela troca o nome e volta a digitar, sem
reconectar, então o `typing.start` que os outros recebem sai com o nome novo.

**Teste previsto:** `test/realtime-people.e2e-spec.ts`, "o digitando sai com o nome novo".

### CA4

**Marca:** teste de unidade

**Cenário:** Dada a camada de Pessoas, começando pela Pessoa da Sessão, quando chega um
`person.updated`, então a entrada da Pessoa troca o nome, as iniciais, o `@usuário` e o cargo, e
as outras entradas ficam as mesmas (o mesmo objeto, para não renderizar de novo). Sem entrada, a
leitura devolve o que veio no payload.

**Teste previsto:** Vitest, `src/app/utils/people-store.test.ts`.

### CA5

**Marca:** teste no Playwright

**Cenário:** Dada uma Pessoa vendo outra numa Mensagem, na barra lateral (Conversa direta), nos
Membros e no cabeçalho da Conversa direta, quando a outra salva o nome novo, então todos esses
lugares o mostram sem recarregar. Na reconexão, a lista de Conversas e o perfil aberto são lidos de
novo.

**Teste previsto:** Playwright, `e2e/perfil/perfil-em-tempo-real.spec.ts`, "o nome novo aparece
sem recarregar".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dadas duas Pessoas em dois contextos, e a que edita com duas abas, quando ela salva o
nome, então a outra vê o nome novo numa Mensagem antiga, na barra lateral, nos Membros e no perfil,
e a segunda aba de quem editou muda o Rail e o menu do avatar, sem recarregar.

**Teste previsto:** Playwright, `e2e/perfil/perfil-em-tempo-real.spec.ts`, "as outras abas de quem
editou mudam o Rail".

## Contrato

### `person.updated` · servidor → cliente · novo

| Item | O que descreve |
| --- | --- |
| Quem recebe | A sala `workspace`: todo socket conectado, inclusive os da própria Pessoa |
| Autenticação | A do handshake (spec da F03, "Conexão") |
| Carga | `id`, `name`, `username` (texto) e `title` (texto ou nulo) |
| Confirmação | Nenhuma |
| Erros | Nenhum; a falha da emissão só fica em log |

Não entra em `StoredEventPayloads`: não é guardado nem reenviado (spec da F09, "Tempo real").

### Sala `workspace` · nova

O middleware do handshake põe todo socket nela, junto de `person:<id>` e `session:<id>`.

## Verificação do contrato

- O evento e quem o recebe: CA1 e CA2.
- A ausência no reenvio: CA2.

## Decisões

- **Quem publica.** O `ProfilesController` compara a Pessoa do guard (a de antes) com a gravada e
  chama `RealtimePublisher.personUpdated` quando o nome, o `@usuário` ou o cargo mudou. O comando de
  contas não publica (spec da F09, "Comando de contas").
- **Emissão sem stream.** `personUpdated` emite direto na sala `workspace`, sem o `EventsStore`.
- **Nome no "digitando".** Ao publicar, o gateway troca o nome no `socket.data.person` dos sockets
  locais da Pessoa (`server.sockets.sockets`, filtrando pelo id). Basta a instância única.
- **Camada de Pessoas.** `utils/people-store.ts`, um armazenamento externo com `getSnapshot`,
  `subscribe`, `seed` e `apply`, lido por `usePerson(id, fallback)` com `useSyncExternalStore`. As
  iniciais saem de `utils/initials.ts`. O provider fica no layout logado, dentro do
  `RealtimeProvider`, e assina o `person.updated` pelo listener novo `onPersonUpdated`.
- **Componentes de Pessoa.** Os lugares da tarefa passam a ler por `usePerson`: autor da Mensagem e
  da Citação, linha de Conversa direta da barra lateral, linha de Pessoa (Membros e busca),
  cabeçalho e início da Conversa direta, Rail e menu do avatar.
- **Perfil salvo.** O diálogo aplica o Perfil na camada na hora, e a Server Action deixa de
  revalidar o layout (a decisão da F09-T01 que esta tarefa troca).
- **Perfil aberto.** O `person.updated` da Pessoa do painel aberto o lê de novo (`mutate` na chave
  do Perfil), para o cargo e o nome novos.
- **Reconexão.** No `sync`, a camada revalida a lista de Conversas e o perfil aberto; as Mensagens
  já carregadas guardam o nome que tinham (risco aceito na spec, "Nome perdido durante uma queda").

## Arquivos e interfaces

- **Contrato:** `packages/chat-events/index.d.ts`, com `PersonUpdatedEvent` e `person.updated` em
  `ServerToClientEvents`.
- **API:** `realtime.gateway.ts` (sala `workspace` e `renamePerson`), `realtime.publisher.ts`
  (`personUpdated`), `realtime-socket.ts` (`WORKSPACE_ROOM`), `profiles.controller.ts` e
  `profiles.module.ts` (importa o `RealtimeModule`).
- **Web:** `utils/people-store.ts`, `components/people/people-provider.tsx` (`PeopleProvider` e
  `usePerson`), `realtime-provider.tsx` (`onPersonUpdated`), os componentes de Pessoa citados,
  `edit-profile-dialog.tsx` e `actions/update-profile.ts`.
- **Testes:** os de cada critério.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano. Na entrega, o LLD passa a sala `workspace`, o `person.updated` e a
camada de Pessoas a `existe`.
