# Validação visual da F14-T02

Feita em 1440 × 900, nos dois temas, com a Conversa aberta pela web de desenvolvimento e comparada
com os frames da seção "Relatório em PDF (F14)" do Figma (`docs/design-system.md`, "Validação
visual").

| Estado | Figma | Código |
| --- | --- | --- |
| Entrega | `Conversa / Relatório / Entrega` (210:64122) e `(escuro)` (210:64502) | [entrega-claro.png](entrega-claro.png), [entrega-escuro.png](entrega-escuro.png) |
| Entrega bloqueada | `Conversa / Relatório / Entrega bloqueada` (210:64882) e `(escuro)` (210:65251) | [entrega-bloqueada-claro.png](entrega-bloqueada-claro.png), [entrega-bloqueada-escuro.png](entrega-bloqueada-escuro.png) |

O que foi conferido no `ReportCard` (componente 210:1303):

- borda `border`, fundo `surface`, raio `radius/card`, `space/3` de margem interna e entre as partes;
- o selo "PDF" de 40 × 40 em `surface-inset`, raio `radius/item`, `caption/bold` em `fg-muted`;
- o nome do arquivo em `body/bold` `fg` e o tamanho em `small/regular` `fg-muted`;
- "Baixar" com a seta para baixo, `small/bold` em `link`, com o fundo `surface-subtle` no hover;
- a Menção a quem pediu no texto do Agente, no estilo da Menção à própria Pessoa (a linha toda
  ganha o destaque de Menção, como nas Mensagens de Pessoas);
- na entrega bloqueada, o aviso no lugar do texto e nenhum cartão.

Diferença aceita: as capturas usam os nomes e o Canal gerados pelo teste, e não os da tela de
exemplo do Figma.
