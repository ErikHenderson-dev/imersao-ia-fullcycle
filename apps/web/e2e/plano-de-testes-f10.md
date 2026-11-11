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

Os testes da F10 que leem ou mudam o estado de conexão de um Agente gravam no Banco dos agentes
(`support/agents.ts`) e seguram o fixture `agentsLock`, uma trava `pg_advisory_lock`: o estado é
global, e dois testes em paralelo não podem mudá-lo um do outro. Quem dá o papel de administrador
usa o fixture `makeAdmin`, que o tira no fim.

## F10-T05 · Ver os Agentes e os administradores (`agentes/ver-agentes.spec.ts`)

1. **GET /api/agents exige Sessão e traz o catálogo:** com Sessão, o `assistente`; sem, 401.
2. **A seção mostra os conectados e Ver agentes:** com o `assistente` conectado, a linha e a ação;
   desconectado, só a ação.
3. **Quem não administra vê os Agentes e os administradores e abre um perfil pelo teclado:** sem
   conectados, o aviso, o Agente com "Não conectado" e sem "Conectar"; o Bruno na lista de
   administradores; Enter nele fecha o diálogo e abre o perfil; Esc devolve o foco a "Ver agentes".
4. **Os estados do diálogo:** Erro com "Tentar de novo", que lê de novo; Vazio; sem
   administradores. As rotas do BFF são trocadas no navegador.

Acessibilidade (`acessibilidade/agentes-sem-violacoes.spec.ts`): o diálogo de quem não administra,
com um administrador, nos dois temas, sem violações do axe.
