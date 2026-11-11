# Roteiro manual da F10-T07

A nota de Acessibilidade do Lighthouse nos dois temas, com o diálogo "Agentes" aberto como
administrador e como quem não administra, que o Playwright não mede (spec da F10, "Decisões de
teste", "Roteiro manual").

**Situação:** executado; todas as notas são 100.

| # | Tela | Quem | Tema | Nota esperada | Nota obtida |
| --- | --- | --- | --- | --- | --- |
| 1 | Diálogo "Agentes" | administrador | claro | 100 | 100 |
| 2 | Diálogo "Agentes" | administrador | escuro | 100 | 100 |
| 3 | Diálogo "Agentes" | quem não administra | claro | 100 | 100 |
| 4 | Diálogo "Agentes" | quem não administra | escuro | 100 | 100 |

Em cada passo: entrar com a conta, trocar o tema, abrir o diálogo pela ação da seção Agentes,
abrir DevTools → Lighthouse → modo Snapshot, só "Accessibility", e registrar a nota e as falhas
apontadas.

## Como foi medido

Em 2026-11-11, como na F09-T05: Lighthouse 13.6.0 num *user flow* (modo Snapshot, só a categoria
Accessibility), no Chromium 1254 do contêiner `e2e` (HeadlessChrome 158), em 1440 × 900, contra o
build de produção (`pnpm build` e `pnpm start` no contêiner `web`, na porta 3000). As duas contas
foram criadas no banco de desenvolvimento (uma com o papel de administrador) e entraram pelo
formulário; o tema foi trocado pelo atributo `data-theme` entre as rodadas, e o diálogo foi aberto
pela ação da seção Agentes ("Conectar agentes" para o administrador, "Ver agentes" para quem não
administra). Nenhuma auditoria de acessibilidade com peso ficou abaixo de 1.
