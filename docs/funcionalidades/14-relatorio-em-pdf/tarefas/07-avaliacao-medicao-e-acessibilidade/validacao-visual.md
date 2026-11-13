# Validação visual final da F14

2026-11-12 · F14-T07, CA5. Em 1440 × 900, nos dois temas, com a versão final do código, comparada
com os frames da seção "Relatório em PDF (F14)" do Figma (`docs/design-system.md`, "Validação
visual").

| Estado | Figma | Código |
| --- | --- | --- |
| Entrega | `Conversa / Relatório / Entrega` e `(escuro)` | [entrega-claro.png](entrega-claro.png), [entrega-escuro.png](entrega-escuro.png) |
| Entrega bloqueada | `Conversa / Relatório / Entrega bloqueada` e `(escuro)` | [entrega-bloqueada-claro.png](entrega-bloqueada-claro.png), [entrega-bloqueada-escuro.png](entrega-bloqueada-escuro.png) |
| PDF | `Relatório / PDF / Março de 2026` | [validacao-pdf.md](../03-worker-gera-e-entrega-o-pdf/validacao-pdf.md), da tarefa 03, sem mudança de layout desde então; só a definição dos Clientes ativos passou a citar os 90 dias da janela |

O `ReportCard`, o aviso e a Resposta bloqueada seguem como na validação da tarefa 02
([validacao-visual.md](../02-entrega-com-cartao-e-download/validacao-visual.md)). A única mudança
visível é a Menção à própria Pessoa no tema escuro: o `mention-self-fg` passou de `yellow/300` para
`yellow/200`, no Figma (variável `mention/mention-self-fg`, modo Dark), no `globals.css` e no
`design-system.md`, para a Menção numa linha destacada passar no contraste de 4,5:1
(`e2e/acessibilidade/relatorio-sem-violacoes.spec.ts`).
