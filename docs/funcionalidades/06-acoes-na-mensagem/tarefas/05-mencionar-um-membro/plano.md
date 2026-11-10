# Plano da F06-T05: Mencionar um Membro

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma, página Telas, e encontra a "Conversa / Composer / Lista de
menções" (23:14538) só com Pessoas, sem `@canal`, `@aqui` e o agente, e "Conversa / Mensagem /
Menciona você" (22:8334) com a Menção "@admin".

### CA2

**Marca:** teste HTTP

**Cenário:** Dado um Canal privado com Membros, quando um Membro envia uma Mensagem com `@usuario`
de Membros, de quem não é Membro e de quem não existe, em minúsculas e maiúsculas, repetidos e
dentro de um e-mail, então só os Membros viram Menção, uma vez cada, em `message_mentions`; editar
para tirar uma Menção e pôr outra grava a diferença; apagar mantém as Menções; o reenvio do mesmo
`client_id` não grava Menções a mais.

**Teste previsto:** e2e da API, `test/messages-mentions.e2e-spec.ts`, "grava as Menções dos Membros
no envio", "não menciona quem não é Membro nem quem não existe", "a edição grava a diferença", "apagar
mantém as Menções" e "o reenvio não grava Menções a mais"; unidade, `src/messages/mentions.spec.ts`,
para a extração.

### CA3

**Marca:** teste HTTP

**Cenário:** A Mensagem no envio, na edição, no histórico e nos eventos traz `mentions` com `id` e
`username` das Pessoas mencionadas, ou vazia.

**Teste previsto:** e2e da API, `test/messages-mentions.e2e-spec.ts`, "o histórico e a edição trazem
mentions"; `test/realtime-messages.e2e-spec.ts`, o `message.created` e o `message.updated` comparados
com a resposta inteira já cobrem o campo.

### CA4

**Marca:** teste HTTP

**Cenário:** A busca de Pessoas com `member_of` traz só os Membros da Conversa, com o texto, a ordem e
o limite de antes; quem não é Membro recebe 404; `member_of` com `not_member_of`, 400.

**Teste previsto:** e2e da API, `test/people-search.e2e-spec.ts`, "member_of traz só os Membros",
"member_of de quem não é Membro responde 404" e "member_of com not_member_of responde 400".

### CA5

**Marca:** teste no Playwright

**Cenário:** Na caixa de mensagem e na edição, `@` no começo ou depois de espaço abre a lista dos
Membros, filtrada pelo que vem depois; o botão `@` insere o `@` e abre; setas mudam a Pessoa
destacada, Enter ou Tab escolhe, Esc fecha; Enter com a lista aberta não envia; escolher troca o
texto por `@usuario `; sem resultado, a lista fecha.

**Teste previsto:** Playwright, `e2e/conversa/mencionar.spec.ts`, "menciona pela lista só pelo
teclado", "o botão @ abre a lista", "Esc fecha a lista sem mudar o texto", "sem resultado a lista
fecha" e "menciona na edição".

### CA6

**Marca:** teste no Playwright

**Cenário:** A Menção aparece como `@usuario`, azul para os outros e amarela para a própria pessoa,
com a Mensagem inteira no tom de "Menciona você"; clicar abre o Perfil; um `@usuario` de quem não é
Membro fica como texto; a Menção acrescentada numa edição destaca na hora para a outra Pessoa.

**Teste previsto:** Playwright, `e2e/tempo-real/mencao.spec.ts`, "a Pessoa mencionada vê o destaque
e abre o Perfil pela Menção" e "a Menção acrescentada na edição destaca sem recarregar"; Vitest,
`src/app/utils/message-segments.test.ts`, para a divisão do corpo.

### CA7

**Marca:** teste HTTP

**Cenário:** O dos CA2 a CA4, e o Vitest da divisão do corpo, da detecção do `@` e da troca pelo
escolhido.

**Teste previsto:** os dos CA2 a CA4; Vitest, `src/app/utils/message-segments.test.ts` e
`src/app/utils/mention-query.test.ts`.

### CA8

**Marca:** teste no Playwright

**Cenário:** O dos CA5 e CA6, e o axe com a lista de menções aberta, sem violações.

**Teste previsto:** os dos CA5 e CA6, e `e2e/acessibilidade/mencoes-sem-violacoes.spec.ts`.

### CA9

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra as capturas da "Lista de
menções" e de "Menciona você", nos dois temas, ao lado dos frames.

## Contrato

### message_mentions · chat · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | uuid | não | — | UUID v7 gerado na aplicação |
| `created_at`, `updated_at` | timestamptz | não | `now()` | como em toda tabela |
| `message_id` | uuid | não | — | referência a `messages`, `ON DELETE CASCADE` |
| `person_id` | uuid | não | — | referência a `people`, `ON DELETE CASCADE` |

- Única `(message_id, person_id)`.
- Índice em `person_id`.

### Mensagem no REST e nos eventos · alterada

Depois: mais `mentions`, lista de `{ id, username }`, vazia sem Menções.

### GET /v1/people · alterada

| Item | Mudança |
| --- | --- |
| Parâmetros de consulta | `member_of`, uuid opcional: só os Membros da Conversa |
| Erros | 404 `conversation_not_found` quando quem busca não é Membro da Conversa de `member_of`; 400 `validation_failed` com `member_of` e `not_member_of` juntos |

### GET /api/people (BFF) · alterada

Repassa `member_of` à API.

## Verificação do contrato

- `message_mentions` e a unicidade: CA2.
- `mentions` na Mensagem: CA3.
- `member_of`, 404 e 400: CA4.

## Decisões

- A extração é uma função pura da API, `extractMentionUsernames(body)`: `@` no começo do texto ou
  depois de um caractere que não é letra, número, `.`, `_` ou `-`, seguido do formato do `username`
  da F05, em minúsculas e sem repetir.
- A resolução é uma consulta só: as Pessoas com aqueles `username` que são Membros da Conversa.
- O envio grava as Menções na mesma transação, só quando a Mensagem é nova. A edição, com o texto
  mudado, apaga as que saíram e insere as novas. A exclusão não mexe nelas.
- As Menções de uma página do histórico vêm numa consulta só, pelos ids da página, e entram na
  `MessageView` como `mentions`.
- A busca com `member_of` reaproveita a busca da F05, com a lista dos Membros como filtro de
  inclusão em vez de exclusão.
- Na web, a divisão do corpo em texto, link e Menção é uma função pura sobre o resultado de
  `splitLinks`: os pedaços de texto passam por uma segunda divisão, que só reconhece os `username` de
  `mentions`.
- A MentionChip é um botão que abre o Perfil (o mesmo provedor do painel de perfil da F05), com
  `mention-self-*` para a pessoa logada e `mention-*` para os outros; a Mensagem que menciona a pessoa
  logada ganha `highlight-bg` e a borda `highlight-border` à esquerda.
- A lista de menções é um componente cliente, `MentionPicker`, posicionado acima da caixa, que recebe
  a textarea por ref e a posição do cursor: a detecção do `@` e a troca do texto são funções puras em
  `utils/mention-query.ts`. A busca usa o `usePeopleSearch` com `member_of`.
- O botão `@` da caixa de mensagem é um IconButton (`at-sign`) à esquerda, como no Figma.

## Arquivos e interfaces

- `apps/chat-api/migrations/<ts>-CreateMessageMentions.ts`.
- `apps/chat-api/src/messages/message-mention.entity.ts` e `mentions.ts`
  (`extractMentionUsernames`).
- `apps/chat-api/src/messages/messages.service.ts`: gravar, recalcular e carregar as Menções.
- `apps/chat-api/src/messages/message.response.ts`: `mentions`.
- `apps/chat-api/src/people/people.service.ts`: `findMembersByUsernames`, a busca com inclusão.
- `apps/chat-api/src/memberships/`: `member_of` no query e no service.
- `packages/chat-events/index.d.ts`: `MessagePayload.mentions`.
- `apps/web/src/app/services/chat-api.ts`, `utils/message-event.ts`, `api/people/route.ts`,
  `services/people-search.ts`, `hooks/use-people-search.ts`: `mentions` e `member_of`.
- `apps/web/src/app/utils/message-segments.ts` e `mention-query.ts`.
- `apps/web/src/app/components/message/message-body.tsx`, `mention-chip.tsx`, `message-item.tsx`.
- `apps/web/src/app/components/message/mention-picker.tsx`, usado por `message-composer.tsx` e
  `message-editor.tsx`.

## Testes existentes que mudam

- Os testes que comparam a Mensagem inteira ganham `mentions: []` onde não há Menção.

## Mudança de dados

Nenhuma: as Mensagens que já existem ficam sem Menções.

## Documentos atualizados

Nenhum no commit de plano: a spec e o LLD já registram as Menções como planejadas.
