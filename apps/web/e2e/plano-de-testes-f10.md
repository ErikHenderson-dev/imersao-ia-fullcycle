# Plano de testes da F10 · Conexão de agentes

Os cenários do Playwright da F10, por tarefa, escritos pelo fluxo da skill `playwright-cli`. As
Pessoas, os Canais e as Mensagens são criados direto no banco (`support/database.ts`). O papel de
administrador também: o contêiner `e2e` não tem o comando de contas, e `setAdminOf` grava o
`is_admin` que o `set-admin` gravaria.

## F10-T01 · Ação da barra lateral compartilhada

Sem cenário novo: os testes que já abrem "Adicionar canal" e "Nova conversa" passam sem mudança.

## F10-T02 · Papel de administrador e selo no perfil (`perfil/selo-de-administrador.spec.ts`)

1. **O selo aparece no perfil de quem administra e não no de quem não administra:** o Bruno abre o
   perfil da Ana, administradora, pelo autor da Mensagem e vê "Administrador"; o próprio perfil
   dele não tem o selo; a Ana abre o próprio Perfil pelo menu do avatar, pelo teclado, e vê o selo.
2. **O papel dado depois aparece na próxima abertura do perfil, sem sair e entrar.**

Acessibilidade (`acessibilidade/selo-de-administrador-sem-violacoes.spec.ts`): o próprio Perfil
com o selo, nos dois temas, sem violações do axe.
