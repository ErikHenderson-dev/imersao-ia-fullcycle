# Plano da F05-T06: "Nova conversa": buscar por nome ou @usuário

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas) e encontra, na seção
"Diálogos da casca", o frame "Diálogos / Nova conversa / Falha ao abrir" e, nos frames de
"Diálogos / Adicionar pessoas", as PersonRows com "@usuário · cargo", feitos antes do código das
telas.

### CA2

**Marca:** teste HTTP

**Cenário:** Dada uma Pessoa com Sessão, quando ela busca pelo `@usuário` de outra, com e sem o
`@`, ou pelo nome sem acento, então a outra aparece; sem `not_member_of`, a própria Pessoa aparece
na busca; com ele, a busca continua como na F04; `%` e `_` continuam valendo como literais.

**Teste previsto:** e2e da API, `test/people-search.e2e-spec.ts`, "acha pelo @usuário, com e sem
o @", "sem not_member_of, inclui quem busca" e os casos da F04, que continuam.

### CA3

**Marca:** teste HTTP

**Cenário:** Cada Pessoa da busca e de `GET /v1/conversations/:id/members` traz `username` e
`title`.

**Teste previsto:** e2e da API, `test/people-search.e2e-spec.ts`, "cada Pessoa traz o @usuário e o
cargo", e `test/conversation-members.e2e-spec.ts`, com `username` e `title` nos Membros.

### CA4

**Marca:** teste no Playwright

**Cenário:** No "Nova conversa" e no "Adicionar pessoas", o foco fica no campo, as setas mudam a
Pessoa destacada e Enter a escolhe; cada linha mostra "@usuário · cargo", sem o cargo quando ele
não existe, e "(você)" ao lado da própria pessoa.

**Teste previsto:** Playwright, `e2e/conversa-direta/nova-conversa.spec.ts`, "busca pelo @usuário e
escolhe pelas setas e Enter", e os testes do "Adicionar pessoas" da F04, que passam a escolher pelo
papel `option`.

### CA5

**Marca:** teste no Playwright

**Cenário:** "Nova conversa", no fim de "Mensagens diretas", abre o diálogo com o foco na busca;
sem nada digitado, lista as Pessoas com a própria; sem resultado, "Ninguém encontrado" com o texto
buscado; escolher uma Pessoa deixa a lista em "Abrindo" e abre a Conversa direta, fechando o
diálogo; na falha, o diálogo fica aberto com o erro e permite tentar de novo; Esc fecha e devolve o
foco.

**Teste previsto:** Playwright, `e2e/conversa-direta/nova-conversa.spec.ts`, "busca pelo @usuário e
escolhe pelas setas e Enter", "a própria pessoa abre a Conversa consigo mesma", "mostra Ninguém
encontrado", "a falha ao abrir mantém o diálogo e tenta de novo" e "Esc fecha e devolve o foco".

### CA6

**Marca:** teste HTTP

**Cenário:** Os testes do CA2 e do CA3.

**Teste previsto:** os do CA2 e do CA3.

### CA7

**Marca:** teste no Playwright

**Cenário:** Os cenários do CA4 e do CA5, mais o "Adicionar pessoas" achando pelo `@usuário`, e o
axe sem violações no diálogo "Nova conversa".

**Teste previsto:** Playwright, `e2e/conversa-direta/nova-conversa.spec.ts`,
`e2e/canais-privados/adicionar-pessoas-na-criacao.spec.ts` ("acha pelo @usuário") e
`e2e/acessibilidade/nova-conversa-sem-violacoes.spec.ts`.

### CA8

**Marca:** revisão humana

**Cenário:** Quem revisa abre a pasta desta tarefa e encontra `validacao-visual.md`, com o diálogo
"Nova conversa" nos estados Lista, Ninguém encontrado, Abrindo e Falha ao abrir, nos dois temas, ao
lado dos frames; e `roteiro-manual.md`, com o roteiro do Lighthouse (nota 100 de Acessibilidade) do
diálogo, do painel de perfil e da Conversa direta, para uma pessoa executar.

## Contrato

### GET /v1/people · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| `not_member_of` | Obrigatório | Opcional; sem ele, ninguém fica de fora |
| `q` | Contém, no nome | Contém, no nome ou no `username`, sem o `@` do começo |
| Resposta | `people`: `id`, `name` | `people`: `id`, `name`, `username`, `title` |

### GET /v1/conversations/:id/members · alterada

Resposta: cada Membro ganha `username` e `title`.

### GET /api/people · alterada (BFF)

`not_member_of` opcional; cada Pessoa ganha `username` e `title`, além das iniciais.

## Verificação do contrato

- `GET /v1/people` com e sem `not_member_of`, pelo `username`: CA2; os campos novos: CA3.
- `GET /v1/conversations/:id/members` com os campos novos: CA3.

## Decisões

- **Busca:** o `PeopleService.search` compara `unaccent(lower(name))` ou `lower(username)` com o
  texto sem o `@` inicial. O `MembershipsService.searchPeople` confere o `not_member_of` só quando
  ele vem. O `SearchPeopleQuery` deixa o campo opcional.
- **Pessoa nas listas:** a `PersonSummary` ganha `username` e `title`, nas duas listas.
- **Componente de busca:** `PeoplePicker`, um combobox (o `input` com `role="combobox"`,
  `aria-controls`, `aria-activedescendant` e `aria-expanded`) e um `listbox` com as Pessoas como
  `option`. As setas mudam a destacada, Enter a escolhe, e o clique também. O fetch, com a espera e
  o descarte de resposta antiga da F04, sai do passo "Adicionar pessoas" para um hook,
  `usePeopleSearch(query, notMemberOf?)`. O passo da F04 marca as escolhidas com `aria-selected`.
- **PersonRow:** ganha a segunda linha, "@usuário · cargo".
- **Nova conversa:** `NewConversationAction`, a SidebarAction no fim de "Mensagens diretas", abre o
  Dialog "Nova conversa", com a descrição do Figma. Escolher uma Pessoa chama a mesma abertura do
  painel de perfil, que sai do painel para um hook, `useOpenDirectConversation`: insere a Conversa
  na lista, leva a ela e devolve o estado (`idle`, `opening`, `failed`). Em "Abrindo", a lista fica
  com `opacity-50` e não aceita outra escolha.
- **Ninguém encontrado:** o EmptyState com o ícone `Search`, "Ninguém encontrado" e "Nenhuma
  pessoa corresponde a "<texto>". Confira a grafia ou busque pelo @usuário.".

## Arquivos e interfaces

- `apps/chat-api/src/people/people.service.ts`, `person-summary.ts`;
  `apps/chat-api/src/memberships/memberships.service.ts`, `search-people.query.ts`,
  `memberships.controller.ts`.
- `apps/web/src/app/services/chat-api.ts` (`searchPeople`, `PersonSummary`),
  `api/people/route.ts`.
- `apps/web/src/app/hooks/use-people-search.ts` e `use-open-direct-conversation.ts`.
- `apps/web/src/app/components/user/people-picker.tsx` e `person-row.tsx`.
- `apps/web/src/app/components/conversation/add-people-step.tsx`.
- `apps/web/src/app/components/workspace-nav/new-conversation-action.tsx` e
  `conversation-list.tsx`.
- `apps/web/src/app/components/profile/profile-panel.tsx`: usa o hook de abertura.
- `apps/web/e2e/conversa-direta/nova-conversa.spec.ts`,
  `e2e/acessibilidade/nova-conversa-sem-violacoes.spec.ts`, `e2e/plano-de-testes-f05.md` e o
  helper `e2e/support/add-people-step.ts`.

## Testes existentes que mudam

- `test/people-search.e2e-spec.ts`: o caso de `not_member_of` obrigatório (400 sem ele) passa a ser
  o da busca sem ele; os `toEqual` das Pessoas ganham `username` e `title`.
- `test/conversation-members.e2e-spec.ts`: os Membros ganham `username` e `title`.
- Os testes do "Adicionar pessoas" da F04 (`e2e/canais-privados/*`): a busca vira `combobox` e
  as Pessoas viram `option`.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum. O LLD já registra a busca pelo `@usuário` como `planejada`.
