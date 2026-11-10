# Plano da F05-T01: @usuário, cargo e telefone pelo comando de contas

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado o banco de testes com as migrações rodadas, quando o teste grava uma Pessoa com
`username` fora do formato, repetido ou nulo, cargo com 81 caracteres ou com quebra de linha, e
telefone com letra ou com 31 caracteres, então o banco recusa cada gravação; e um fuso qualquer, ou
nulo, é aceito.

**Teste previsto:** e2e da API, `test/database.e2e-spec.ts`, "people recusa %s" (`it.each`) e
"people aceita cargo, telefone e fuso nulos".

### CA2

**Marca:** teste de unidade

**Cenário:** Dada uma lista de e-mails na ordem de criação das contas, quando a migração atribui o
`@usuário` de cada uma, então cada uma recebe a parte do e-mail antes do `@` pela regra da spec, as
repetidas recebem `2`, `3` e assim por diante pela ordem da lista, pulando um valor que já está na
lista, e as que ficam com menos de 2 caracteres recebem `pessoa`, com o mesmo sufixo.

**Teste previsto:** unidade, `src/people/username.spec.ts`, "assignUsernames dá sufixo pela ordem
de criação", "assignUsernames pula um @usuário que já existe na lista" e "assignUsernames usa
pessoa para o que sobra curto".

### CA3

**Marca:** teste de unidade

**Cenário:** Dado um e-mail com acento, `+`, maiúsculas, pontos ou hífens nas pontas, ou uma parte
local longa, quando a API deriva o `@usuário`, então o resultado segue o formato do `@usuário`,
corta para caber o sufixo e nunca termina com `.`, `_` ou `-`.

**Teste previsto:** unidade, `src/people/username.spec.ts`, "usernameBase deriva %s" (`it.each`) e
"withSuffix corta a base para caber o sufixo".

### CA4

**Marca:** teste de integração

**Cenário:** Dado o comando de contas, quando quem opera roda `create` com `--username`, `--title`
e `--phone`, então a conta nasce com os três; sem `--username`, nasce com o derivado do e-mail, e
com sufixo quando ele já existe; com `--username` já usado ou fora do formato, cargo ou telefone
fora da regra, ou uma opção desconhecida, o comando sai com 1, diz o motivo e não cria a conta; e
`--title ""` grava nulo.

**Teste previsto:** integração, `src/accounts/accounts.command.int-spec.ts`, "create grava o
@usuário, o cargo e o telefone informados", "create deriva o @usuário do e-mail, com sufixo quando
repete", "create recusa %s" (`it.each`) e "create grava cargo vazio como nulo".

### CA5

**Marca:** teste de integração

**Cenário:** Dada uma conta, quando quem opera roda `update-profile <e-mail> --title <cargo>` ou
`--phone <tel>`, então o campo muda e o outro fica; com `""`, o campo vira nulo; sem nenhuma das
duas opções, com `--username`, com conta inexistente ou com valor fora da regra, sai com 1 e diz o
motivo, sem mudar nada.

**Teste previsto:** integração, `src/accounts/accounts.command.int-spec.ts`, "update-profile troca
o cargo e mantém o telefone", "update-profile apaga com valor vazio" e "update-profile recusa %s"
(`it.each`).

### CA6

**Marca:** teste HTTP

**Cenário:** Dada uma Pessoa, quando ela entra e quando a Sessão é verificada, então a Pessoa da
resposta traz `username`.

**Teste previsto:** e2e da API, `test/sessions.e2e-spec.ts`, os casos "responde 201 com o token e
a Pessoa…" e o de `GET /v1/sessions/current`, com o `username` no `toEqual`.

### CA7

**Marca:** documento

**Cenário:** Quem revisa confere que os testes previstos do CA1 ao CA6 existem e passam na
verificação completa.

### CA8

**Marca:** documento

**Cenário:** Quem revisa encontra, na tabela "Comandos" do `apps/chat-api/AGENTS.md`, o `create`
com as opções novas e a linha do `update-profile`.

## Contrato

### people · chat · alterada

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `username` | text | não | — | Única. `CHECK` do formato do @usuário |
| `title` | text | sim | — | `CHECK` de 1 a 80 caracteres, sem quebra de linha |
| `phone` | text | sim | — | `CHECK` de 1 a 30 caracteres, só dígitos, espaço, `+`, `-`, `(` e `)` |
| `time_zone` | text | sim | — | Conferido só na aplicação (a 03 grava) |

- Única nova: `people_username_key` em `username`.
- Os três `CHECK` (`people_username_check`, `people_title_check` e `people_phone_check`) ficam nas
  entidades com `@Check` e na migração; a migração é escrita à mão, porque a coluna obrigatória
  nasce nula, é preenchida e só depois vira `NOT NULL` e única.

### POST /v1/sessions · alterada

Resposta de sucesso: a `person` ganha `username` (string).

### GET /v1/sessions/current · alterada

Resposta de sucesso: a `person` ganha `username` (string).

## Verificação do contrato

- Colunas, única e `CHECK` de `people`: CA1.
- `username` na resposta das duas rotas de Sessão: CA6.

## Decisões

- **Uma derivação só, em TypeScript.** A spec dizia que a migração espelha a função em SQL; o
  plano usa a mesma função pura na migração, que lê as Pessoas pela ordem do id (UUID v7, a ordem de
  criação), atribui os `@usuário` em memória e grava num `UPDATE … FROM unnest(...)`. Uma regra
  escrita duas vezes diverge sem aviso, e o CA2 a prova sem precisar de um banco em estado antigo.
  A spec, seção "Pessoas", muda no commit de plano.
- Funções puras em `username.ts`: `usernameBase(email)` (a base pela regra, ou `pessoa`),
  `withSuffix(base, n)` (corta a base para caber o número e tira o que não é letra ou número do
  fim) e `assignUsernames(emails)`. O formato é uma expressão regular exportada, a mesma do `CHECK`.
- **Conta nova:** o `PeopleService.create` recebe `username`, `title` e `phone` opcionais. Sem
  `username`, procura os `@usuário` que começam pela base e escolhe o primeiro livre; a unicidade do
  banco decide entre duas criações ao mesmo tempo, e a criação tenta de novo com o próximo sufixo,
  até 5 vezes. Com `username` informado, o conflito é `UsernameTakenError`.
- **Erros novos:** `UsernameTakenError` e `InvalidProfileError` (com o campo e o motivo), os dois
  com o código `validation_failed`, porque só o comando os usa nesta tarefa.
- **Opções do comando:** `--nome valor`, com o valor no argumento seguinte; uma opção desconhecida,
  repetida ou sem valor mostra o uso. O nome continua posicional, depois do e-mail.
- O cargo é aparado e uma linha só; vazio, nulo. O telefone é aparado; vazio, nulo.
- A Pessoa da Sessão ganha só `username` nesta tarefa; o `time_zone` entra com a 03.

## Arquivos e interfaces

- `apps/chat-api/src/people/username.ts` e `username.spec.ts`: `USERNAME_PATTERN`,
  `usernameBase`, `withSuffix`, `assignUsernames`.
- `apps/chat-api/src/people/profile-values.ts`: limites e expressões do cargo e do telefone, e
  `normalizeTitle` e `normalizePhone`.
- `apps/chat-api/src/people/person.entity.ts`: as quatro colunas e os `@Check`.
- `apps/chat-api/src/people/people.service.ts`: `create` com o perfil e `updateProfile(email,
  changes)`.
- `apps/chat-api/src/people/username-taken.error.ts` e `invalid-profile.error.ts`.
- `apps/chat-api/src/conversations/conversations.service.ts`: `NewPerson` com o perfil, repassado
  pelo `createPersonInPublicChannels`.
- `apps/chat-api/src/accounts/accounts.command.ts`: opções do `create` e a operação
  `update-profile`.
- `apps/chat-api/src/sessions/person.response.ts`: `username`.
- `apps/chat-api/migrations/<timestamp>-AddPersonProfile.ts`.
- `apps/chat-api/AGENTS.md`, seção "Comandos".

## Testes existentes que mudam

- `test/sessions.e2e-spec.ts`: a Pessoa da resposta ganha `username`, nos `toEqual`.

## Mudança de dados

Backfill do `@usuário` de todas as Pessoas que já existem, na migração (CA2).

## Documentos atualizados

- `docs/funcionalidades/05-busca-de-pessoas-perfil-e-conversa-direta/spec.md`, seção "Pessoas":
  a migração usa a mesma função pura da API, em vez de espelhá-la em SQL.
- `docs/roadmap.md`: F05 em andamento.
