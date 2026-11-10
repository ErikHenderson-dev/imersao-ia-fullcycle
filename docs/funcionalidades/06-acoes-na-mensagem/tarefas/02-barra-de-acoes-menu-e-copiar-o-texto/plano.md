# Plano da F06-T02: Barra de ações, menu e copiar o texto

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma, página Telas, e encontra o frame "Conversa / Sobreposições /
Erro ao copiar", nos temas claro e escuro, com o toast de erro "Não foi possível copiar o texto"
no canto inferior direito, feito com os componentes e as variáveis do design system.

### CA2

**Marca:** teste no Playwright

**Cenário:** Dado uma Pessoa numa Conversa, quando ela copia o texto de uma Mensagem, então o
toast "Texto copiado" aparece no canto inferior direito com o botão de fechar; e as dicas dos
botões da barra aparecem ao passar o mouse ou focar.

**Teste previsto:** Playwright, `e2e/conversa/acoes-na-mensagem.spec.ts`, "copia o texto de uma
Mensagem pela barra e pelo menu" (o toast) e "mostra a dica dos botões da barra".

### CA3

**Marca:** teste no Playwright

**Cenário:** Dado uma Conversa com uma Mensagem enviada e uma com falha no envio, quando a Pessoa
passa o mouse ou foca cada uma, então a enviada mostra a barra com "Copiar texto" e "Mais ações",
e "Mais ações" abre o menu com "Copiar texto"; a Mensagem com falha não mostra barra nem menu.

**Teste previsto:** Playwright, `e2e/conversa/acoes-na-mensagem.spec.ts`, "mostra a barra no hover
e no foco" e "a Mensagem com falha no envio não tem barra".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dada uma Mensagem com quebra de linha e um link, quando a Pessoa escolhe "Copiar
texto" pela barra ou pelo menu, então a área de transferência tem exatamente o texto gravado, sem
autor nem hora, e aparece "Texto copiado"; quando o navegador recusa a escrita, aparece "Não foi
possível copiar o texto" e nada mais muda.

**Teste previsto:** Playwright, `e2e/conversa/acoes-na-mensagem.spec.ts`, "copia o texto de uma
Mensagem pela barra e pelo menu" (com `clipboard-read` e `clipboard-write` concedidas) e "mostra o
erro quando o navegador recusa a cópia" (com `navigator.clipboard.writeText` rejeitando, por
`addInitScript`).

### CA5

**Marca:** teste no Playwright

**Cenário:** Dada uma Mensagem focada pelo teclado, quando a Pessoa avança com Tab, então chega a
"Copiar texto" e "Mais ações"; Enter ou Espaço em "Mais ações" abre o menu, as setas mudam o item,
e Esc fecha o menu e devolve o foco a "Mais ações".

**Teste previsto:** Playwright, `e2e/conversa/acoes-na-mensagem.spec.ts`, "usa a barra e o menu só
pelo teclado".

### CA6

**Marca:** teste no Playwright

**Cenário:** O dos CA2 a CA5, e a checagem do axe na Conversa com a barra e o menu abertos, sem
violações.

**Teste previsto:** os do CA2 a CA5 e `e2e/conversa/acoes-na-mensagem.spec.ts`, "a barra e o menu
não têm violações de acessibilidade".

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra as capturas da
barra no hover e do menu de uma Mensagem de outra Pessoa, nos dois temas, em 1440 × 900, ao lado
dos frames "Hover com barra de ações" (22:10143) e "Menu de mensagem de terceiros" (23:19029), com
as diferenças anotadas.

## Contrato

O contrato não muda.

## Verificação do contrato

Nenhuma: nenhum item de contrato nasce ou muda.

## Decisões

- A MessageActions e a MessageMenu ficam num componente cliente pequeno,
  `components/message/message-actions.tsx`, recebido pela MessageItem só quando o `status` é
  `sent`. A MessageItem continua sem `"use client"` próprio (ela já roda dentro do histórico, que é
  cliente), e a barra é posicionada no canto superior direito da linha, em `z-10` (`z/toolbar`).
- A barra aparece por CSS (`group-hover` e `group-focus-within`) e também enquanto o menu está
  aberto, para o menu não perder a âncora quando o mouse sai.
- A lista de ações é uma lista de itens (`id`, rótulo, ícone, tom, ação), da qual a barra e o menu
  leem. A 03, a 04 e a 06 acrescentam "Editar", "Apagar" e "Responder" como itens, sem mudar a
  estrutura. A ordem de exibição é a do Figma: Responder, Copiar texto, Editar, e Apagar separado.
- O IconButton ganha o Tooltip do design system (Radix, atraso de 400 ms) no lugar do `title`,
  para a dica ser a mesma ao passar o mouse e ao focar; um `TooltipProvider` entra no layout das
  telas logadas.
- A cópia é uma função cliente, `copyMessageText(body)`, que chama
  `navigator.clipboard.writeText` e mostra o toast pelo `sonner`. O texto copiado é o `body` como
  está no cache (o texto gravado).
- O `sonner` é instalado na versão exata mais recente com mais de duas semanas, e o `Toaster`, um
  componente cliente em `components/ui/toaster.tsx`, entra no layout das telas logadas, no canto
  inferior direito, com `closeButton` e as cores do tema (design system, "Toast").

## Arquivos e interfaces

- `apps/web/package.json`: `sonner`.
- `apps/web/src/app/components/ui/tooltip.tsx`: `TooltipProvider`, `Tooltip` (gatilho e conteúdo).
- `apps/web/src/app/components/ui/toaster.tsx`: `Toaster`.
- `apps/web/src/app/components/ui/icon-button.tsx`: a dica pelo `Tooltip`.
- `apps/web/src/app/components/message/message-actions.tsx`: `MessageActions` (barra e menu) e o
  tipo `MessageAction`.
- `apps/web/src/app/components/message/message-item.tsx`: a barra na linha, só em `sent`.
- `apps/web/src/app/utils/copy-message-text.ts`: `copyMessageText`.
- O layout das telas logadas: `TooltipProvider` e `Toaster`.
- `apps/web/e2e/conversa/acoes-na-mensagem.spec.ts`: os testes da barra, do menu e da cópia.

## Testes existentes que mudam

Nenhum. Os testes que localizam botões do IconButton pelo nome acessível continuam valendo, porque
o `aria-label` fica.

## Mudança de dados

Nenhuma.

## Documentos atualizados

- `docs/design-system.md`, seção "Bibliotecas": o `sonner` passa de "A instalar" a "Instalado"
  (na implementação, junto da instalação).
