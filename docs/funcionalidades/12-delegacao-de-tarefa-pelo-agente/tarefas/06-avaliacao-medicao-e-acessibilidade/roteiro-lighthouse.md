# Roteiro manual: Lighthouse da aba Tarefas (F12-T06, CA6)

Feito por uma pessoa, no Chrome da máquina, com o ambiente de desenvolvimento de pé (`AGENTS.md` da
raiz, "Subir e derrubar").

## Preparação

1. Entre com uma Pessoa que tenha Tarefas recebidas e delegadas, abertas e concluídas. O jeito mais
   rápido é mencionar o `@assistente` num Canal com outra Pessoa e pedir "delega pra @fulano revisar
   o contrato" algumas vezes, e concluir uma das Tarefas com a outra Pessoa.
2. Abra `http://localhost:3000/atividade?aba=tarefas`.

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

A meta é 100 nos dois temas (PRD da F12, "Critérios de aceite", "Todas as histórias"). A checagem
automática com o axe na mesma tela passa nos dois temas
(`e2e/acessibilidade/tarefas-sem-violacoes.spec.ts`).

**Situação:** dispensado pelo usuário em 2026-11-12, como na F11. O roteiro fica para quando a
medição for feita.
