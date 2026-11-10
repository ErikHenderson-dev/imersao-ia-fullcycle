# Roteiro manual da F08-T01

Feito por uma pessoa, no Chrome da máquina, com o ambiente de pé (`AGENTS.md`, "Subir e derrubar")
e uma conta com ao menos uma Menção e uma Mensagem direta não lidas.

## Lighthouse na tela Atividade

1. Entrar e abrir `http://localhost:3000/atividade`.
2. DevTools → Lighthouse → modo "Navigation", categoria "Accessibility", dispositivo "Desktop".
3. Rodar e anotar a nota abaixo. A esperada é 100; qualquer outra vira correção antes do merge.

| Data | Quem | Nota de Acessibilidade | Observações |
| --- | --- | --- | --- |
| A preencher | | | |

Pendente: o CA9 da tarefa fica desmarcado até esta linha ser preenchida. A tentativa de rodar o
Lighthouse sozinho no contêiner `e2e` não manteve a Sessão (a aba caía em "Entrar"), e a nota fica
para uma pessoa, no Chrome da máquina.

O axe do Playwright (`e2e/acessibilidade/atividade-sem-violacoes.spec.ts`) já roda as mesmas regras
de acessibilidade a cada verificação completa e passa sem violações.
