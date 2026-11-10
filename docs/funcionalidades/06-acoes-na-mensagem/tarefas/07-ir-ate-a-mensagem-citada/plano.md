# Plano da F06-T07: Ir até a Mensagem citada

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma, página Telas, seção Conversa, e encontra o frame "Conversa /
Lista / Mensagem citada indisponível" (133:36772), com o aviso "A mensagem não está mais
disponível" no canto inferior direito.

### CA2

**Marca:** teste no Playwright

**Cenário:** Dada uma resposta que cita uma Mensagem já carregada, quando a pessoa clica na Citação,
então a Conversa rola até a original, no centro, e a destaca por 2 s.

**Teste previsto:** Playwright, `e2e/conversa/ir-ate-a-citada.spec.ts`, "vai até a original
carregada e a destaca".

### CA3

**Marca:** teste no Playwright

**Cenário:** Dada uma resposta que cita uma Mensagem fora da página carregada, quando a pessoa clica
na Citação, então a Conversa mostra "Indo até a mensagem", carrega as páginas anteriores até a
original e rola até ela; se a original foi apagada no meio, aparece "A mensagem não está mais
disponível".

**Teste previsto:** Playwright, `e2e/conversa/ir-ate-a-citada.spec.ts`, "carrega as anteriores até a
original" e "avisa quando a original não está mais disponível"; Vitest,
`src/app/utils/jump-to-message.test.ts`, para a decisão de parar.

### CA4

**Marca:** teste no Playwright

**Cenário:** Enquanto vai até a Mensagem, uma Mensagem nova não puxa a lista para o fim.

**Teste previsto:** Playwright, `e2e/conversa/ir-ate-a-citada.spec.ts`, "carrega as anteriores até a
original" (com uma Mensagem nova chegando durante a ida).

### CA5

**Marca:** teste de unidade

**Cenário:** A decisão de parar: para quando a página carregada contém a original ou já começa antes
dela (pelos ids UUID v7), ou quando não há mais páginas; caso contrário, continua.

**Teste previsto:** Vitest, `src/app/utils/jump-to-message.test.ts`; Playwright, os do CA2 e CA3,
pelo mouse e pelo teclado.

### CA6

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md` e encontra as capturas de "Indo até a mensagem"
e "Destaque por link", nos dois temas, ao lado dos frames.

## Contrato

O contrato não muda: a ida usa a página do histórico da F02, com o tamanho máximo de página.

## Verificação do contrato

Nenhuma.

## Decisões

- A ReplyQuote não apagada vira um botão ("Ir até a mensagem de <nome>"), e a apagada continua texto.
- A ida é uma função do histórico (`goToMessage(id)`): com a original na lista, rola (`scrollIntoView`
  no centro) e marca o destaque por 2 s; sem ela, entra no estado "Indo até a mensagem" e carrega
  páginas anteriores pelo mesmo `loadOlder` do histórico, até a função pura `jumpStep(pages, id)`
  dizer "achou", "parou sem achar" ou "continua".
- O tamanho da página da ida é o máximo do histórico (100), pela rota do BFF com `limit`.
- Enquanto vai, a rolagem automática da Mensagem nova fica desligada, como a pílula de novas
  Mensagens da F03 já faz quando a lista não está no fim.
- O estado "Indo até a mensagem" reaproveita a JumpStatusPill do Figma ("Indo até a mensagem…"),
  no topo da lista; o aviso de indisponível é um toast.
- O destaque usa os tokens `highlight-bg` e `highlight-border` (tom "Destaque por link" da
  MessageItem), num atributo `data-highlighted` que some depois de 2 s.

## Arquivos e interfaces

- `apps/web/src/app/utils/jump-to-message.ts`: `jumpStep`.
- `apps/web/src/app/hooks/use-message-history.ts`: o tamanho da página na carga das anteriores
  durante a ida.
- `apps/web/src/app/components/conversation/message-history.tsx`: `goToMessage`, o estado da ida e o
  destaque.
- `apps/web/src/app/components/message/reply-quote.tsx` e `message-item.tsx`: o botão da Citação e o
  destaque.
- `apps/web/e2e/conversa/ir-ate-a-citada.spec.ts`.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano.
