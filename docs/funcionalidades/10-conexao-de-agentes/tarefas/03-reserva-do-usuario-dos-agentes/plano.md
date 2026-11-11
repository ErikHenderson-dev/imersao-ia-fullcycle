# Plano da F10-T03: Reserva do @usuário dos Agentes

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado o banco `chat_test` migrado, quando o teste insere em `bots` um `username`
repetido, um fora do formato do `@usuário` ou um nome vazio ou com quebra de linha, então o banco
recusa cada um pela restrição correspondente (`bots_username_key`, `bots_username_check`,
`bots_name_check`).

**Teste previsto:** e2e da API, `test/database.e2e-spec.ts`, bloco "bots".

### CA2

**Marca:** teste de integração

**Cenário:**
- `create-bot assistente Assistente` cria o bot e escreve "Bot criado: @assistente (Assistente,
  <id>).".
- Recusa, com saída 1 e sem criar nada: `@usuário` fora do formato (a mensagem do formato), nome
  vazio ou acima de 80 (a mensagem do nome), `@usuário` de uma Pessoa ("O @usuário <u> já é de uma
  Pessoa."), `@usuário` de outro bot ("O @usuário <u> já é de um bot.") e argumentos faltando (o
  uso).

**Teste previsto:** integração, `src/accounts/accounts.command.int-spec.ts`, bloco "create-bot".

### CA3

**Marca:** teste de integração

**Cenário:**
- Dado o bot `assistente`, quando `create` recebe `--username assistente`, então sai com 1 e "O
  @usuário assistente já é de um bot.", antes de pedir a senha, sem criar a Pessoa.
- Dado o bot `assistente`, quando `create` recebe o e-mail `assistente@<domínio>` sem
  `--username`, então a Pessoa é criada com `assistente2`.

**Teste previsto:** integração, `src/accounts/accounts.command.int-spec.ts`, "create recusa o
@usuário de um bot" e "create deriva do e-mail um @usuário que não é de um bot".

### CA4

**Marca:** teste HTTP

**Cenário:** Dado um bot cujo nome e `@usuário` casam com a busca, quando uma Pessoa chama
`GET /v1/people?q=<texto>`, então o bot não aparece nos resultados; os testes de busca, Membros,
Presença e login que já existem passam sem mudança.

**Teste previsto:** e2e da API, `test/people-search.e2e-spec.ts`, "não traz os bots".

### CA5

**Marca:** documento

**Cenário:** Quem revisa abre o `AGENTS.md` da raiz e encontra, no guia de subida, a criação do bot
`assistente` com `pnpm accounts create-bot assistente Assistente`; e, no `apps/chat-api/AGENTS.md`,
a linha do comando na tabela.

## Contrato

### bots · chat · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | não | — | UUID v7, gerado na aplicação |
| `username` | `text` | não | — | O `@usuário` do Agente, igual ao `slug` do catálogo |
| `name` | `text` | não | — | O nome de exibição |
| `created_at` | `timestamptz` | não | `now()` | |
| `updated_at` | `timestamptz` | não | `now()` | |

- Chave primária: `id`.
- Única: `bots_username_key` em `username`.
- `bots_username_check`: `username ~ '<USERNAME_PATTERN>'`, a mesma expressão de
  `people_username_check`.
- `bots_name_check`: `char_length(name) BETWEEN 1 AND 80 AND name !~ '[\r\n]'`, a mesma de
  `people_name_check`.
- Os dois CHECKs ficam na entidade (`@Check`) e são escritos à mão na migração `AddBots`, como os de
  `people`.

## Verificação do contrato

- Única e os dois CHECKs de `bots`: CA1.

## Decisões

- **Módulo `bots`.** `Bot` (entidade), `BotsService` com `create({ username, name })` e
  `findByUsername(username)`, pelo `TransactionHost`, como o `PeopleService`. O `AccountsModule`
  importa o `BotsModule`. Nenhum outro módulo o importa na F10.
- **A função de "`@usuário` livre" mora no comando de contas.** `UsernameAvailability`, em
  `src/accounts/username-availability.ts`, com `ownerOf(username): Promise<'person' | 'bot' |
  null>`, que consulta `PeopleService` e `BotsService`. O `create-bot` e o `create` com
  `--username` recusam o `@usuário` com dono por `UsernameUnavailableError`
  (`validation_failed`), com a mensagem pelo dono.
- **O `@usuário` derivado do e-mail passa pela mesma função.** `PeopleService.create` ganha a opção
  `isUsernameFree`, chamada para cada candidato que `people` não tem, até achar um livre; o comando
  passa `(u) => availability.ownerOf(u).then((owner) => owner === null)`. Sem a opção, o service
  confere só `people`, como hoje. O `PeopleService` não importa nada do módulo `bots`.
- **Sem trava entre `people` e `bots`.** Como diz a spec, a disputa entre duas execuções
  simultâneas do comando é desprezível; o índice único de cada tabela continua decidindo dentro
  dela.
- **Nome do bot pela regra do nome das Pessoas.** `parseName` de `people/profile-values.ts`, que já
  é utilitário puro.

## Arquivos e interfaces

- `apps/chat-api/migrations/<ts>-AddBots.ts`: nova.
- `apps/chat-api/src/bots/bot.entity.ts`, `bots.service.ts`, `bots.module.ts`: novos.
- `apps/chat-api/src/accounts/username-availability.ts`: novo, `UsernameAvailability`.
- `apps/chat-api/src/accounts/username-unavailable.error.ts`: novo.
- `apps/chat-api/src/accounts/accounts.command.ts`: operação `create-bot`, a conferência no
  `create`, o construtor recebe `BotsService`.
- `apps/chat-api/src/accounts/accounts.module.ts` e `cli.ts`: o `BotsModule` e o `BotsService`.
- `apps/chat-api/src/people/people.service.ts`: `NewPerson` ganha `isUsernameFree?`.
- `apps/chat-api/test/database.e2e-spec.ts`, `test/people-search.e2e-spec.ts`: casos novos.
- `AGENTS.md` (raiz) e `apps/chat-api/AGENTS.md`: o comando.

## Testes existentes que mudam

- `src/accounts/accounts.command.int-spec.ts`: o `command()` monta o `AccountsCommand` com o
  `BotsService`, pela nova assinatura do construtor.

## Mudança de dados

Nenhuma. O bot `assistente` é criado à mão pelo comando, no guia de subida.

## Documentos atualizados

Nenhum no commit de plano: o LLD e o ADR 0028 já registram a tabela e a reserva como planejadas.
