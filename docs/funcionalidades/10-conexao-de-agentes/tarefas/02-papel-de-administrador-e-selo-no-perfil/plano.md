# Plano da F10-T02: Papel de administrador e selo no perfil

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado o banco `chat_test` migrado, quando o teste lê a coluna `is_admin` de uma Pessoa
inserida sem informá-la, então ela é `false`, e o banco recusa `NULL` nela.

**Teste previsto:** e2e da API, `test/database.e2e-spec.ts`, "people tem is_admin, falso por
padrão e obrigatório".

### CA2

**Marca:** teste HTTP

**Cenário:**
- Dada uma Pessoa administradora com Sessão, quando ela chama `GET /v1/sessions/current`, então a
  Pessoa vem com `is_admin: true`; e quem não administra vem com `false`.
- Dado o Perfil de uma administradora, quando outra Pessoa chama `GET /v1/people/:id`, então ele
  vem com `is_admin: true`.
- Dada uma Pessoa com Sessão aberta, quando o papel muda no banco e ela chama de novo
  `GET /v1/sessions/current` com a mesma Sessão, então `is_admin` já vem com o valor novo.

**Teste previsto:** e2e da API, `test/sessions.e2e-spec.ts`, "traz is_admin lido do banco a cada
requisição", e `test/people-profile.e2e-spec.ts`, "traz is_admin no Perfil".

### CA3

**Marca:** teste de integração

**Cenário:**
- `set-admin <e-mail> on` dá o papel e escreve "<nome> agora é administrador(a)."; `off` tira e
  escreve "<nome> deixou de ser administrador(a).".
- `set-admin @<usuário> on` acha a Pessoa pelo `@usuário`.
- Repetir o mesmo valor não muda nada e escreve "<nome> já era administrador(a)." ou "<nome> já
  não era administrador(a).".
- Pessoa inexistente pelo e-mail ou pelo `@usuário` sai com 1 e a mensagem do `PersonNotFoundError`;
  argumento faltando ou valor fora de `on|off` sai com 1 e o uso.

**Teste previsto:** integração, `src/accounts/accounts.command.int-spec.ts`, bloco "set-admin".

### CA4

**Marca:** revisão humana

**Cenário:** Quem revisa abre `profile-panel.tsx` e encontra o selo abaixo do `@usuário`, só quando
o Perfil traz `isAdmin`, com os tokens do frame 26:45404 ("Admin badge": `bg-surface-inset`, borda
`border-subtle`, `rounded-control`, `px-2 py-0.5`, `shield-check` de 12 px decorativo e o texto
"Administrador" em `text-small text-fg-muted`), sem cor solta, e com o texto visível como nome
acessível.

### CA5

**Marca:** teste no Playwright

**Cenário:** Dadas uma administradora e outra Pessoa no mesmo Canal, quando a outra abre o perfil
da administradora pelo autor da Mensagem, então vê o selo "Administrador"; quando a administradora
abre o próprio Perfil pelo menu do avatar, também vê; o perfil de quem não administra não tem o
selo. O axe no painel de perfil com o selo, nos temas claro e escuro, não acha violações.

**Teste previsto:** Playwright, `e2e/perfil/selo-de-administrador.spec.ts`, "o selo aparece no
perfil de quem administra e não no de quem não administra", e
`e2e/acessibilidade/selo-de-administrador-sem-violacoes.spec.ts`.

### CA6

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra o painel de perfil com
o selo, nos dois temas, ao lado do frame "Painel de perfil / Selo de administrador" (26:45404).

## Contrato

### people · chat · alterada

- `is_admin`: `boolean`, não nulo, padrão `false`. Quem já existe fica com `false`. Migração
  `AddPersonIsAdmin`.

### `GET /v1/sessions/current` · alterada

- Resposta de sucesso: a Pessoa ganha `is_admin` (booleano).

### `GET /v1/people/:id` · alterada

- Resposta de sucesso: o Perfil ganha `is_admin` (booleano).

## Verificação do contrato

- Coluna `is_admin` e o padrão: CA1.
- `is_admin` em `GET /v1/sessions/current` e em `GET /v1/people/:id`: CA2.

## Decisões

- **`set-admin` pelo e-mail ou pelo `@usuário`.** Um argumento que começa com `@` é `@usuário`,
  sem o `@`; o resto é e-mail, normalizado como no `create`. O `PeopleService` ganha
  `findByUsername` e `setAdmin(personId, isAdmin)`, que devolve se mudou.
- **Mensagens neutras de gênero.** A spec dá "Fulana agora é administradora"; o comando não sabe o
  gênero, e escreve "administrador(a)", como as outras mensagens do comando ("Sessão(ões)").
- **Papel na preparação do Playwright pelo banco.** O contêiner `e2e` não tem o comando de contas,
  que roda no `chat-api`. O teste grava `is_admin` direto no banco, com um atalho `setAdminOf` em
  `e2e/support/database.ts`, como já faz com o tema (`setThemeOf`). O comando é provado no CA3.
- **Selo como componente.** `AdminBadge`, em `src/app/components/profile/admin-badge.tsx`, Server
  Component sem estado, usado só pelo painel de perfil. O `@usuário` e o selo ficam na mesma coluna
  de identidade, com o `gap-1` do frame.
- **`isAdmin` nos tipos da web.** `Person` (Sessão) e `Profile` ganham `isAdmin`, convertidos de
  `is_admin` no `services/chat-api.ts`. A Pessoa da Sessão só carrega o campo nesta tarefa: quem o
  usa são a 05 e a 06.

## Arquivos e interfaces

- `apps/chat-api/migrations/<ts>-AddPersonIsAdmin.ts`: nova.
- `apps/chat-api/src/people/person.entity.ts`: `isAdmin: boolean`.
- `apps/chat-api/src/people/people.service.ts`: `findByUsername(username)`, `setAdmin(personId,
  isAdmin): Promise<boolean>`; o `insert` devolve também `is_admin`.
- `apps/chat-api/src/people/profile.response.ts` e `src/sessions/person.response.ts`: `is_admin`.
- `apps/chat-api/src/accounts/accounts.command.ts`: operação `set-admin` e o uso.
- `apps/web/src/app/services/chat-api.ts`: `isAdmin` em `Person` e `Profile`.
- `apps/web/src/app/components/profile/admin-badge.tsx`: novo, `AdminBadge()`.
- `apps/web/src/app/components/profile/profile-panel.tsx`: o selo abaixo do `@usuário`.
- `apps/web/e2e/support/database.ts`: `setAdminOf(personId, isAdmin)`.
- `apps/chat-api/AGENTS.md`: a linha do `pnpm accounts set-admin` na tabela de comandos.

## Testes existentes que mudam

- `test/sessions.e2e-spec.ts` e `test/people-profile.e2e-spec.ts`: os casos que comparam o corpo
  inteiro da Pessoa e do Perfil passam a esperar `is_admin: false`.
- Testes de unidade da web que montam um `Person` ou um `Profile` à mão ganham `isAdmin`, se o
  tipo os obrigar.

## Mudança de dados

Nenhuma além do padrão `false` da migração.

## Documentos atualizados

Nenhum no commit de plano: o LLD e a spec já registram a coluna, as rotas e o comando como
`planejados`. A passagem a `existe` entra no commit de registros da tarefa.
