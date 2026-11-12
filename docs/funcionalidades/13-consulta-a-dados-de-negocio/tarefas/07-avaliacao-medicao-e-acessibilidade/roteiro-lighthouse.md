# Roteiro manual: Lighthouse da Conversa com a Resposta bloqueada (F13-T07, CA6)

Feito por uma pessoa, no Chrome da máquina, com o ambiente de desenvolvimento de pé (`AGENTS.md` da
raiz, "Subir e derrubar") e o Banco de negócio carregado.

## Preparação

1. Duas Pessoas no mesmo Canal: a Ana, com Permissão de dados (`pnpm accounts set-data-access
   <e-mail> on`), e o Bruno, sem.
2. A Ana menciona o `@assistente` e pergunta "quanto faturamos em março de 2026?" e, depois, pede o
   resumo de hoje: a Conversa fica com uma resposta completa (o resumo) e uma com Dados de negócio.
3. Entre como o Bruno e abra o Canal: ele vê o resumo e a Resposta bloqueada.

## Medição

1. Abra o DevTools, aba Lighthouse, modo "Navegação", dispositivo "Computador", só a categoria
   "Acessibilidade".
2. Rode no tema claro e anote a nota.
3. Troque para o tema escuro pelo botão do rail, recarregue e rode de novo.

## Resultado

| Tema | Nota de Acessibilidade | Data | Quem mediu |
| --- | --- | --- | --- |
| Claro | a preencher | | |
| Escuro | a preencher | | |

A checagem automática com o axe, nos dois temas, passa
(`e2e/acessibilidade/resposta-bloqueada-sem-violacoes.spec.ts`).
