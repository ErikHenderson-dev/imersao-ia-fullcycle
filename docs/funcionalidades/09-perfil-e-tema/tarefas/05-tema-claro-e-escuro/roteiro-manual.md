# Roteiro manual da F09-T05

A nota de Acessibilidade do Lighthouse nos dois temas, que o Playwright não mede (spec da F09,
"Decisões de teste", "Roteiro manual"). Feito por uma pessoa, no Chrome, com o build de produção.

**Situação:** executado; todas as notas são 100.

| # | Tela | Tema | Nota esperada | Nota obtida |
| --- | --- | --- | --- | --- |
| 1 | Conversa | claro | 100 | 100 |
| 2 | Conversa | escuro | 100 | 100 |
| 3 | Atividade | claro | 100 | 100 |
| 4 | Atividade | escuro | 100 | 100 |

Em cada passo: trocar o tema pelo botão do Rail, abrir DevTools → Lighthouse → só
"Accessibility", e registrar a nota e as falhas apontadas.

## Como foi medido

Em 2026-11-10, com o Lighthouse 13.6.0 num *user flow* (modo Snapshot, só a categoria
Accessibility), no Chromium 1254 do contêiner `e2e`, em 1440 × 900, contra o `next dev`. A conta
tinha um Status com mensagem e entrou pelo formulário; o tema foi trocado pelo botão do Rail entre
as duas rodadas. Nenhuma auditoria de acessibilidade com peso ficou abaixo de 1.
