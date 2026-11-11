# Roteiro manual da F10-T07

A nota de Acessibilidade do Lighthouse nos dois temas, com o diálogo "Agentes" aberto como
administrador e como quem não administra, que o Playwright não mede (spec da F10, "Decisões de
teste", "Roteiro manual").

**Situação:** a medir, na verificação final da F10, contra o build de produção.

| # | Tela | Quem | Tema | Nota esperada | Nota obtida |
| --- | --- | --- | --- | --- | --- |
| 1 | Diálogo "Agentes" | administrador | claro | 100 | — |
| 2 | Diálogo "Agentes" | administrador | escuro | 100 | — |
| 3 | Diálogo "Agentes" | quem não administra | claro | 100 | — |
| 4 | Diálogo "Agentes" | quem não administra | escuro | 100 | — |

Em cada passo: entrar com a conta, trocar o tema pelo botão do Rail, abrir o diálogo pela ação da
seção Agentes, abrir DevTools → Lighthouse → modo Snapshot, só "Accessibility", e registrar a nota
e as falhas apontadas.
