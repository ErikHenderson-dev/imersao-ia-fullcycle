# Roteiro manual: Lighthouse da Conversa com o Relatório (F14-T07, CA6)

Feito por uma pessoa, no Chrome da máquina, com o ambiente de desenvolvimento de pé (`AGENTS.md` da
raiz, "Subir e derrubar"), o Worker rodando e o Banco de negócio carregado.

## Preparação

1. Duas Pessoas no mesmo Canal: a Ana, com Permissão de dados (`pnpm accounts set-data-access
   <e-mail> on`), e o Bruno, sem.
2. A Ana menciona o `@assistente` e pede "me manda um relatório de março de 2026 em PDF": a Conversa
   fica com o Aviso de início e, logo depois, a entrega com o cartão.

## Medição

1. Entre como a Ana e abra o Canal: ela vê o aviso e a entrega completa, com o cartão.
2. Abra o DevTools, aba Lighthouse, modo "Navegação", dispositivo "Computador", só a categoria
   "Acessibilidade". Rode no tema claro e anote a nota.
3. Troque para o tema escuro pelo botão do rail, recarregue e rode de novo.
4. Entre como o Bruno, abra o mesmo Canal (ele vê o aviso e a entrega como Resposta bloqueada, sem
   cartão) e repita os passos 2 e 3.

## Resultado

| Página | Tema | Nota de Acessibilidade | Data | Quem mediu |
| --- | --- | --- | --- | --- |
| Entrega completa (Ana) | Claro | a medir | | |
| Entrega completa (Ana) | Escuro | a medir | | |
| Entrega bloqueada (Bruno) | Claro | a medir | | |
| Entrega bloqueada (Bruno) | Escuro | a medir | | |

A checagem automática com o axe, nos dois temas e nas duas páginas, passa
(`e2e/acessibilidade/relatorio-sem-violacoes.spec.ts`). Ela levou à troca do `mention-self-fg` do
tema escuro de `yellow/300` para `yellow/200` (design system, "Tema claro e escuro"): a Menção à
própria Pessoa numa linha destacada ficava com contraste 4,3:1, abaixo de 4,5:1.
