# Roteiro manual da F05-T06

Feito por uma pessoa, no Chrome da máquina, com o ambiente de desenvolvimento de pé (`AGENTS.md` da
raiz, "Subir e derrubar"). Cobre a nota do Lighthouse das três telas da F05, que os testes
automáticos não leem (spec da F05, "Decisões de teste"). A checagem do axe, sem violações, já roda
no Playwright para o diálogo "Nova conversa", o painel de perfil e a Conversa direta.

**Situação:** a rodar por uma pessoa. O agente que implementou a tarefa não tem o Lighthouse no
contêiner `e2e`, e a nota é lida no Chrome DevTools da máquina.

## Preparação

1. Criar duas contas pelo comando de contas, a segunda com cargo e telefone
   (`pnpm accounts create <e-mail> "<nome>" --title "<cargo>" --phone "<tel>"`; `apps/chat-api/AGENTS.md`,
   "Comandos").
2. Entrar com a primeira no Chrome.

## 1. Diálogo "Nova conversa"

1. Na barra lateral, em "Mensagens diretas", "Nova conversa".
2. Buscar a segunda conta pelo `@usuário`.
3. Com o diálogo aberto e o resultado na tela, rodar o Lighthouse, só a categoria Accessibility,
   modo Desktop.
   - Esperado: nota 100.

## 2. Painel de perfil

1. Escolher a segunda conta: a Conversa direta abre.
2. No cabeçalho, clicar no nome dela: o painel de perfil abre.
3. Rodar o Lighthouse como acima.
   - Esperado: nota 100.

## 3. Conversa direta

1. Fechar o painel e enviar uma Mensagem.
2. Rodar o Lighthouse como acima.
   - Esperado: nota 100.

## Resultado

| Tela | Nota | Quem rodou e quando |
| --- | --- | --- |
| Diálogo "Nova conversa" | a preencher | a preencher |
| Painel de perfil | a preencher | a preencher |
| Conversa direta | a preencher | a preencher |
