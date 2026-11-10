# Plano da F09-T01: Editar o próprio Perfil

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de ponta a ponta da API

**Cenário:** Dado o banco migrado, quando se grava uma Pessoa com o nome vazio, com quebra de linha
ou com 81 caracteres, então o CHECK `people_name_check` recusa. Dado um nome fora da regra antes da
migração, então ela falha com o id e o e-mail da Pessoa na mensagem.

**Teste previsto:** `test/database.e2e-spec.ts`, nos casos de CHECK de `people`. A falha da migração
fica numa função pura (`assertNamesFitRule`), testada em `src/people/profile-values.spec.ts`.

### CA2

**Marca:** teste de ponta a ponta da API

**Cenário:**
- **Grava:** `PATCH /v1/people/me` grava o nome, o cargo e o telefone, sem espaços nas pontas, e
  devolve 200 com `person`, o Perfil como em `GET /v1/people/:id`.
- **Apaga e preserva:** `null` ou texto vazio apagam o cargo e o telefone, e um campo ausente fica
  como está.
- **Recusa:** responde `validation_failed` (400) para:
  - o `name` nulo, vazio, com quebra de linha ou com 81 caracteres;
  - o cargo fora da regra;
  - o telefone fora da regra;
  - um campo de tipo errado.
- **Sem Sessão:** 401.

**Teste previsto:** `test/people-edit.e2e-spec.ts`.

### CA3

**Marca:** teste de unidade

**Cenário:** Dado o que o diálogo envia, quando a regra compartilhada da web valida, então ela
recusa e aceita os mesmos casos da API, com a mensagem de cada campo. A Server Action devolve:
- `invalid`, com a lista de `{ field, message }`;
- `failure`, para rede, servidor ou um 400 que escape;
- `unauthenticated` no 401, que o diálogo leva a `GET /api/session/expired`.

**Teste previsto:** Vitest, `src/app/utils/profile-fields.test.ts`. A Server Action é coberta pelo
Playwright (CA6).

### CA4

**Marca:** teste no Playwright

**Cenário:** Dado a Pessoa logada:
- **Abrir pelo menu:** "Editar perfil" no menu do avatar abre o diálogo preenchido, com o foco em
  "Nome completo".
- **Fechar:** o Esc fecha sem salvar, e o foco volta ao avatar.
- **Abrir pelo painel:** o botão "Editar perfil" do próprio painel abre o mesmo diálogo, e o foco
  volta a ele ao fechar.
- **Perfil dos outros:** o painel de outra Pessoa não tem o botão.

**Teste previsto:** Playwright, `e2e/perfil/editar-perfil.spec.ts`.

### CA5

**Marca:** teste no Playwright

**Cenário:**
- **Erro de campo:** "Salvar" com o nome vazio mostra "Informe seu nome completo." embaixo do campo,
  com o foco nele, e o diálogo fica aberto com o que foi digitado.
- **Erro geral:** uma falha da API (a Server Action interceptada) mostra o erro geral e mantém os
  campos.
- **Salvo:** com o nome válido, o diálogo fecha, e o nome novo aparece no menu do avatar e no painel.
- **Salvando:** enquanto salva, "Salvando" desabilita o botão.

**Teste previsto:** Playwright, `e2e/perfil/editar-perfil.spec.ts`.

### CA6

**Marca:** teste no Playwright

**Cenário:**
- **Edição completa:** a edição inteira é feita pelo teclado.
- **Outra Pessoa:** em outro contexto, ela vê o nome novo numa Mensagem antiga depois de recarregar.
- **Acessibilidade:** o axe no diálogo aberto, nos dois temas, não acha violações.

**Teste previsto:** Playwright, `e2e/perfil/editar-perfil.spec.ts` e
`e2e/acessibilidade/editar-perfil-sem-violacoes.spec.ts`.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra o diálogo (Padrão, Erro
de campo, Erro geral e Salvando, sem o Status) e o menu com "Editar perfil", nos dois temas, ao lado
dos frames.

## Contrato

- **`PATCH /v1/people/me`:**
  - O corpo tem `name`, `title` e `phone`, todos opcionais. O `name` é texto e não aceita `null`.
    `title` e `phone` aceitam texto ou `null`.
  - Responde 200 com `{ person }`, no formato de `GET /v1/people/:id`.
  - Um campo de outro tipo ou fora da regra responde `validation_failed` (400).
  - O Status entra na 03.
- **Banco:** a coluna `people.name` ganha `people_name_check`:
  `char_length(name) BETWEEN 1 AND 80 AND name !~ '[\r\n]'`.

## Verificação do contrato

- `test/people-edit.e2e-spec.ts` (rota) e `test/database.e2e-spec.ts` (CHECK).

## Decisões

- **Regra do nome.** `profile-values.ts` ganha `NAME_MAX_LENGTH` e `parseName`, que apara, recusa o
  vazio, a quebra de linha e o nome acima de 80 com `InvalidProfileError`. A conta nova
  (`PeopleService.create`) passa pela mesma regra, em vez de só aparar.
- **Edição pelo service.** `PeopleService.updateOwnProfile(personId, changes)` lê, valida cada campo
  presente, grava numa `update` só e devolve a Pessoa. O `updateProfile` do comando de contas
  continua como está.
- **Migração.** Escrita à mão, como a da F05:
  1. procura os nomes fora da regra;
  2. com algum, lança um erro com o id e o e-mail de cada um;
  3. senão, acrescenta o CHECK.

  As outras colunas da spec entram com as tarefas delas (Status na 03, Presença na 04, tema na 05).
- **DTO.** `UpdateProfileDto` aceita `name` como texto (com `@ValidateIf` para recusar o `null`) e
  `title` e `phone` como texto ou `null`. O tamanho fica com o service, para a mensagem ser a mesma
  do comando.
- **Regras na web.** `utils/profile-fields.ts` traz os limites, a validação por campo e as mensagens:
  - "Informe seu nome completo.";
  - "O nome pode ter no máximo 80 caracteres.";
  - as mensagens do cargo e do telefone, iguais às da API.

  A Server Action `updateProfile` usa a mesma validação.
- **Diálogo.**
  - `EditProfileDialog` lê o Perfil pela chave do SWR do painel (`profileKey`) e mostra os campos
    quando ele chega.
  - Ao salvar, grava o Perfil devolvido nessa chave, e a Server Action revalida o layout logado, para
    o Rail e o menu lerem o nome novo do servidor. A camada de Pessoas da 02 troca isso depois.
  - O foco volta a quem abriu: o avatar, a partir do menu, ou o botão do painel.
- **Erro geral.** O texto é "Não foi possível salvar o perfil. Tente de novo.", acima dos botões.
  O texto "Dados inválidos." do frame "Erro geral" (26:39774) não descreve uma falha de rede, e o
  frame passa a ter o texto do código na implementação ("Do código para o Figma").

## Arquivos e interfaces

- **API:**
  - `apps/chat-api/src/people/profile-values.ts`, `people.service.ts` e `person.entity.ts`;
  - a migração `AddPersonNameCheck`;
  - `apps/chat-api/src/profiles/profiles.controller.ts` e `update-profile.dto.ts`.
- **Web:**
  - `apps/web/src/app/utils/profile-fields.ts`;
  - `apps/web/src/app/actions/update-profile.ts`;
  - `services/chat-api.ts`, com `updateProfile`.
- **Componentes da web:**
  - `apps/web/src/app/components/profile/edit-profile-dialog.tsx`;
  - `components/user/user-menu.tsx`;
  - `components/profile/profile-panel.tsx`.
- **Testes:** os de cada critério.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

- O CHECK do nome em `people`. A migração recusa a base com um nome fora da regra.

## Documentos atualizados

- `docs/lld.md`, pela skill `lld`, no commit da entrega: a rota `PATCH /v1/people/me` e o CHECK do
  nome passam a `existe`.
