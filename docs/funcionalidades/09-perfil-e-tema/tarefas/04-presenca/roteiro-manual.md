# Roteiro manual da F09-T04

A nota de Acessibilidade do Lighthouse, que o Playwright não mede (spec da F09, "Decisões de
teste", "Roteiro manual"). Feito por uma pessoa, no Chrome, com o build de produção.

**Situação:** a executar. O critério CA8 da tarefa fica aberto até o resultado ser registrado aqui.

## Preparação

1. Subir o ambiente e a web em modo de produção (`pnpm build` e `pnpm start` no contêiner `web`).
2. Entrar com uma conta que tenha um Status com mensagem e outra conta conectada em outro navegador.

## Passos

| # | Tela | Tema | Nota esperada | Nota obtida |
| --- | --- | --- | --- | --- |
| 1 | Conversa com o painel de perfil de outra Pessoa aberto | claro | 100 | |
| 2 | Conversa com o painel de perfil de outra Pessoa aberto | escuro | 100 | |
| 3 | Conversa com o diálogo "Editar perfil" aberto | claro | 100 | |
| 4 | Conversa com o diálogo "Editar perfil" aberto | escuro | 100 | |

Em cada passo: DevTools → Lighthouse → só "Accessibility", modo "Snapshot" (com o painel ou o
diálogo aberto), e registrar a nota e as falhas apontadas.
