# Plano da F09-T03: Status

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas) e encontra, nos temas claro e
escuro, os frames novos com o emoji de Status no autor da Mensagem, em "Membros de #nome", nos
resultados de "Nova conversa" e no cabeçalho da Conversa direta, o painel de perfil com o texto
do Status e o diálogo "Editar perfil" com o Status limpo. No LLD, "Emojis do Status" traz o 🤒
(`sick`), conferido no frame "Diálogos / Editar perfil / Padrão" (26:38160, "Emoji 🤒").

### CA2

**Marca:** teste de ponta a ponta da API

**Cenário:**
- **Grava:** `PATCH /v1/people/me` com `status_emoji` e `status_text` grava os dois e devolve o
  Perfil com `status: { emoji, text }`; o texto sem emoji é gravado com `speech`; o emoji sem texto
  é válido.
- **Limpa:** os dois nulos limpam o Status, e o Perfil volta com `status: null`.
- **Recusa:** `validation_failed` (400) para o texto acima de 100, com quebra de linha ou com o
  caractere nulo e para a chave fora das sete.
- **Banco:** os CHECKs recusam a chave inválida e o texto com quebra de linha.

**Teste previsto:** `test/people-edit.e2e-spec.ts` e `test/database.e2e-spec.ts`.

### CA3

**Marca:** teste de ponta a ponta da API

**Cenário:** O Status vai no `person.updated` (a mudança só do Status publica), em
`GET /v1/sessions/current`, em `GET /v1/people/:id`, na busca e nos Membros. `GET /v1/people/presence`
devolve só quem tem Status, com `id` e `status`. O BFF expõe o retrato em `GET /api/people/presence`.

**Teste previsto:** `test/people-status.e2e-spec.ts` e `test/realtime-people.e2e-spec.ts`, "a
mudança só do Status publica".

### CA4

**Marca:** teste de unidade

**Cenário:** Dada a camada de Pessoas, quando chega o retrato, então cada Pessoa dele fica com o
Status dele, e quem não está nele fica sem Status; o `person.updated` troca o Status da Pessoa.

**Teste previsto:** Vitest, `src/app/utils/people-store.test.ts`.

### CA5

**Marca:** teste no Playwright

**Cenário:** No diálogo "Editar perfil", os sete emojis são um grupo de rádio: as setas mudam o
marcado, Enter ou espaço no marcado o desmarca; a "Mensagem de status" acima de 100 mostra o erro
embaixo dela; salvar com o emoji e a mensagem grava o Status.

**Teste previsto:** Playwright, `e2e/perfil/status.spec.ts`, "escolhe e limpa o Status pelo
teclado"; Vitest, `src/app/utils/profile-fields.test.ts`, para a regra do texto.

### CA6

**Marca:** teste no Playwright

**Cenário:** O emoji de Status aparece ao lado do nome no autor da Mensagem, na barra lateral, em
"Membros de #nome", nos resultados de "Nova conversa", no cabeçalho da Conversa direta, no Rail
(menu do avatar), e não no Alerta nem na Atividade; o painel de perfil mostra o emoji e a mensagem
por inteiro.

**Teste previsto:** Playwright, `e2e/perfil/status.spec.ts`, "o Status aparece onde o nome
aparece".

### CA7

**Marca:** teste no Playwright

**Cenário:** Dadas duas Pessoas em dois contextos, quando uma define o Status, então a outra vê o
emoji, com a mensagem no Tooltip pelo foco do teclado, sem recarregar; quando ela limpa, o emoji
some. O axe no diálogo e no painel, nos dois temas, não acha violações.

**Teste previsto:** Playwright, `e2e/perfil/status.spec.ts`, "o Status chega sem recarregar e sai
ao limpar", e `e2e/acessibilidade/status-sem-violacoes.spec.ts`.

### CA8

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra o diálogo com o Status
e os lugares com o emoji, nos dois temas, ao lado dos frames.

## Contrato

### people · chat · alterada

- `status_emoji`: texto, nulo, CHECK `status_emoji IN ('speech','headphones','calendar','meal',
  'home','vacation','sick')`, escrito à mão na migração.
- `status_text`: texto, nulo, CHECK `char_length BETWEEN 1 AND 100 AND status_text !~ '[\r\n]'`,
  escrito à mão na migração.
- CHECK `people_status_check`: `status_text IS NULL OR status_emoji IS NOT NULL` (o texto sem emoji
  ganha `speech` no service; o banco recusa o que escapar).

### `PATCH /v1/people/me` · alterada

- Corpo: ganha `status_emoji` (chave ou `null`) e `status_text` (texto ou `null`), opcionais.
- Resposta: o Perfil ganha `status` (`{ emoji, text }` ou `null`).

### `GET /v1/people/:id`, `GET /v1/people` e `GET /v1/conversations/:id/members` · alteradas

- Cada Pessoa ganha `status` (`{ emoji, text }` ou `null`), com `text` nulo quando só há emoji.

### `GET /v1/sessions/current` · alterada

- A Pessoa ganha `status`.

### `GET /v1/people/presence` · nova

- Autenticação: Sessão. Sucesso: 200 com `people`: `{ id, status }` de quem tem Status. Erros:
  `unauthenticated` (401).

### `GET /api/people/presence` (BFF) · nova

- Chama `GET /v1/people/presence` com o cookie; devolve `{ people: [{ id, status }] }`; 401 como a
  API e o resto como 502.

### `person.updated` · alterado

- Carga ganha `status` (`{ emoji, text }` ou `null`). A mudança só do Status também publica.

## Verificação do contrato

- Colunas e CHECKs: CA2.
- `PATCH /v1/people/me` com Status: CA2.
- `status` no Perfil, na busca, nos Membros, na Sessão e no evento; o retrato: CA3.
- O BFF do retrato: CA7 (a outra Pessoa recebe o Status pelo retrato e pelo evento).

## Decisões

- **Chaves no banco, emoji na web.** `utils/status-emojis.ts` mapeia a chave para o emoji e o nome
  acessível ("Conversando", "Em reunião", "Agenda cheia", "Almoçando", "Trabalhando de casa", "De
  férias", "Doente"), na ordem do frame.
- **`status` como objeto.** O Perfil e as listas levam `status: { emoji, text } | null`, montado
  por `toStatusResponse` no módulo de Pessoas, e não duas colunas soltas.
- **Retrato.** `GET /v1/people/presence` fica no controller de `profiles`, antes de `:id`. A web o
  lê no `PeopleProvider` na conexão e a cada reconexão, e o aplica com `store.applySnapshot`, que
  zera o Status de quem não veio nele.
- **UserStatus.** O componente mostra o emoji com `aria-label` "Status: <nome do emoji>: <texto>" e
  o Tooltip com o texto, focável pelo teclado quando há texto. Lê o Status da camada de Pessoas e,
  sem entrada, o do payload.
- **Diálogo.** Os sete emojis num `role="radiogroup"` com setas (`roving tabindex`); a "Mensagem
  de status" é um campo `Input` com o limite; as regras entram em `profile-fields.ts` como
  `statusText`.

## Arquivos e interfaces

- **API:** a migração `AddPersonStatus`; `person.entity.ts`, `profile-values.ts` (`parseStatus`),
  `people.service.ts`, `person-summary.ts`, `profile.response.ts`, `sessions/person.response.ts`,
  `update-profile.dto.ts`, `profiles.controller.ts`; `chat-events` (`StatusPayload`).
- **Web:** `utils/status-emojis.ts`, `utils/profile-fields.ts`, `utils/people-store.ts`,
  `components/people/` (`UserStatus` e o retrato no provider), `services/chat-api.ts`,
  `app/api/people/presence/route.ts`, o diálogo, o painel e os lugares de Pessoa.

## Testes existentes que mudam

- `test/people-edit.e2e-spec.ts` e `test/database.e2e-spec.ts` ganham os casos do Status.
- `test/realtime-people.e2e-spec.ts`: a carga do `person.updated` ganha `status`.

## Mudança de dados

As duas colunas novas, nulas, e os CHECKs.

## Documentos atualizados

Nenhum no commit de plano; na entrega, o LLD passa o Status, o retrato e o `UserStatus` a `existe`.
