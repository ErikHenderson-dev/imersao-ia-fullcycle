# Plano da F07-T05: Título da aba e marcador no rail

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma, página Telas, e encontra o marcador de Não lidas no ícone
Início do rail, em "Casca / Rail / Início ativo" (25:24628) e "Casca / Rail / Atividade ativa"
(25:24898).

### CA2

**Marca:** teste de unidade

**Cenário:** Dada a lista de Conversas, quando o título é montado, então ele começa pela soma das
Menções dos Canais e das Não lidas das Conversas diretas, sem a Conversa aberta com a aba em foco,
como "(3) Full Cycle Chat"; com a soma acima de 99, "(99+) Full Cycle Chat"; sem contador, só "Full
Cycle Chat".

**Teste previsto:** Vitest, `src/app/utils/unread.test.ts`, "o título soma os contadores visíveis" e
"o marcador acende com qualquer Conversa Não lida".

### CA3

**Marca:** teste no Playwright

**Cenário:** Dada uma Conversa com uma Menção Não lida, quando a Pessoa está em outra Conversa,
então o ícone Início mostra o marcador e o rótulo dele diz "Início, há mensagens não lidas"; ao ler,
o marcador some.

**Teste previsto:** Playwright, `e2e/nao-lidas/titulo-e-rail.spec.ts`, "o título e o marcador do
Início avisam e somem ao ler"; Vitest, o do CA2, para a regra do marcador.

### CA4

**Marca:** teste no Playwright

**Cenário:** Dada uma Menção em outra Conversa, quando ela chega, então o título passa a "(1) Full
Cycle Chat" e o Início mostra o marcador; ao abrir a Conversa, os dois somem. A tela Atividade ainda
não existe (F08): o marcador vale no rail de todas as telas logadas.

**Teste previsto:** Playwright, `e2e/nao-lidas/titulo-e-rail.spec.ts`, "o título e o marcador do
Início avisam e somem ao ler".

### CA5

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra o rail com o marcador,
nos dois temas, ao lado dos frames.

## Contrato

O contrato não muda.

## Verificação do contrato

Nenhum item.

## Decisões

- Os dois leem o mesmo cache da lista de Conversas que a barra lateral mantém (SWR global, a chave
  da lista), sem buscar nada: um `useSWR` sem função de busca só acompanha o cache.
- A soma e o marcador saem de funções puras sobre a lista, com a mesma regra de exibição da linha
  (`unreadDisplay`), e a Conversa aberta em foco calculada como na barra lateral (o caminho aberto e
  o foco da aba).
- O título é posto por um componente do cliente no layout das telas logadas, que o reaplica a cada
  navegação, porque o Next.js troca o título pelo da página.
- O marcador é um ponto na cor `badge` sobre o ícone Início, num componente do cliente dentro do
  Rail, que continua Server Component; o rótulo acessível do link passa a dizer "Início, há mensagens
  não lidas".
- A tela Atividade ainda não existe (F08): o marcador vale no rail de todas as telas logadas, e o
  frame "Atividade ativa" ganha o marcador no Figma.

## Arquivos e interfaces

- `apps/web/src/app/utils/unread.ts`: `unreadTitle(conversations, isOpenAndFocused)` e
  `hasVisibleUnread(conversations, isOpenAndFocused)`.
- `apps/web/src/app/hooks/use-visible-unread.ts`: a lista do cache e a regra da Conversa aberta em
  foco.
- `apps/web/src/app/components/workspace-nav/document-title.tsx`: o título.
- `apps/web/src/app/components/workspace-nav/home-link.tsx`: o link Início com o marcador.
- `apps/web/src/app/components/workspace-nav/rail.tsx` e `app/(app)/layout.tsx`: os dois no lugar.

## Testes existentes que mudam

Nenhum: o link Início continua com o nome "Início" quando não há Não lidas.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum: a spec da F07 já descreve o título e o marcador.
