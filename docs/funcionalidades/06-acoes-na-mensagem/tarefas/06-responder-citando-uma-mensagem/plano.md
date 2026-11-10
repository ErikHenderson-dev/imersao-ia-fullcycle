# Plano da F06-T06: Responder citando uma Mensagem

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado um Membro, quando ele envia uma Mensagem com `quoted_message_id` de uma Mensagem da
mesma Conversa, então ela é gravada com a Citação; Citação de outra Conversa, inexistente, malformada
ou apagada responde 404 `quoted_message_not_found`; o reenvio do mesmo `client_id` devolve a
Mensagem já gravada sem olhar a Citação nova.

**Teste previsto:** e2e da API, `test/messages-quote.e2e-spec.ts`, "envia com Citação", "recusa a
Citação de outra Conversa, inexistente ou apagada" e "o reenvio não muda a Citação".

### CA2

**Marca:** teste HTTP

**Cenário:** A Mensagem no envio, no histórico e nos eventos traz `quote`: nula sem Citação; com ela,
`id`, `deleted` e, não apagada, `author` e o `body` atual; a `quote` mostra o texto editado da
original e `deleted: true` depois que ela é apagada.

**Teste previsto:** e2e da API, `test/messages-quote.e2e-spec.ts`, "a quote mostra o texto editado" e
"a quote da original apagada vem como deleted".

### CA3

**Marca:** teste no Playwright

**Cenário:** "Responder" na barra e no menu de qualquer Mensagem enviada põe a caixa em "Respondendo
a <nome>" com o começo do texto, "Cancelar resposta" e o foco na caixa; Esc com a lista de menções
fechada, ou o botão, desistem; responder a outra troca a Citação; trocar de Conversa a limpa.

**Teste previsto:** Playwright, `e2e/conversa/responder-citando.spec.ts`, "responde citando só pelo
teclado", "Cancelar resposta e Esc desistem" e "responder a outra troca a Citação".

### CA4

**Marca:** teste no Playwright

**Cenário:** O envio leva a Citação; a Mensagem pendente já a mostra; a Citação de uma Mensagem
apagada antes do envio vira a falha no envio da F02.

**Teste previsto:** Playwright, `e2e/conversa/responder-citando.spec.ts`, "responde citando só pelo
teclado" e "a Citação apagada antes do envio vira falha".

### CA5

**Marca:** teste de unidade

**Cenário:** A ReplyQuote mostra o nome e o começo do texto, ou "Em resposta a uma mensagem apagada";
o `message.updated` atualiza as `quote` que citam a editada (com o descarte da edição antiga, e sem
mexer na `quote` apagada); o `message.deleted` marca a `quote` como apagada; o `message.deleted` da
Mensagem citada na caixa tira a Citação, com aviso.

**Teste previsto:** Vitest, `src/app/utils/message-pages.test.ts`, "a edição atualiza as quote",
"a quote apagada não volta" e "a exclusão marca as quote"; Playwright,
`e2e/tempo-real/citacao.spec.ts`.

### CA6

**Marca:** teste HTTP

**Cenário:** O dos CA1, CA2 e CA5.

**Teste previsto:** os dos CA1, CA2 e CA5.

### CA7

**Marca:** teste no Playwright

**Cenário:** Duas Pessoas: a Citação muda na outra quando a original é editada e vira "Em resposta a
uma mensagem apagada" quando ela é apagada, sem recarregar; o axe com a caixa em "Citando".

**Teste previsto:** Playwright, `e2e/tempo-real/citacao.spec.ts`;
`e2e/acessibilidade/citacao-sem-violacoes.spec.ts`.

### CA8

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md` e encontra as capturas de "Citando", "Com
citação" e "Citação apagada", nos dois temas, ao lado dos frames.

## Contrato

### messages · chat · alterada

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `quoted_message_id` | uuid | sim | — | nova: referência a `messages`, sem ação na exclusão (a exclusão da Mensagem é lógica) |

Índice em `quoted_message_id`, para a referência.

### POST /v1/conversations/:conversationId/messages · alterada

| Item | Mudança |
| --- | --- |
| Corpo da requisição | `quoted_message_id`, uuid opcional |
| Erros | 404 `quoted_message_not_found` |

### Mensagem no REST e nos eventos · alterada

Depois: mais `quote`: `null`, ou `{ id, deleted: false, author: { id, name }, body }`, ou
`{ id, deleted: true }`.

## Verificação do contrato

- `quoted_message_id` e o 404: CA1.
- `quote` nos três formatos: CA2.

## Decisões

- O envio confere a Citação na mesma transação, antes de gravar: a original precisa ser da mesma
  Conversa e não apagada. O id malformado não chega ao banco (o DTO o valida como uuid e responde
  400).
- As `quote` de uma página vêm numa consulta só, pelos `quoted_message_id` da página, junto com os
  autores das originais.
- O `quoted_message_not_found` entra no catálogo e no filter global.
- Na web, a Citação em andamento é um estado do histórico da Conversa, que a caixa de mensagem
  mostra; como o histórico monta de novo a cada Conversa, trocar de Conversa a limpa.
- A ReplyQuote é um componente da Mensagem, com o nome em `bold` e o começo do texto em uma linha.
- As `quote` carregadas são atualizadas por uma função pura (`patchQuotes`) aplicada no `message.updated`
  e no `message.deleted`; a edição só troca a `quote` quando não está apagada.
- "Responder" entra primeiro na lista de ações, como no Figma, e vale para qualquer Mensagem enviada.

## Arquivos e interfaces

- `apps/chat-api/migrations/<ts>-AddMessageQuote.ts`.
- `apps/chat-api/src/messages/message.entity.ts`, `send-message.dto.ts`, `messages.service.ts`,
  `message.response.ts`, `quoted-message-not-found.error.ts`.
- `packages/chat-events/index.d.ts`: `MessagePayload.quote`.
- `apps/web/src/app/services/chat-api.ts`, `actions/send-message.ts`, `utils/message-event.ts`,
  `utils/message-pages.ts`, `hooks/use-pending-messages.ts`, `hooks/use-message-history.ts`.
- `apps/web/src/app/components/message/reply-quote.tsx`, `message-item.tsx`, `message-actions.tsx`.
- `apps/web/src/app/components/conversation/message-composer.tsx` e `message-history.tsx`.

## Testes existentes que mudam

Nenhum, além das Mensagens de teste que ganham `quote: null`.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: a spec e o LLD já registram a Citação como planejada.
