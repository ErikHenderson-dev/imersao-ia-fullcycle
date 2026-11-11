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

## F10-T06 · Conectar um Agente (`agentes/conectar-agente.spec.ts`)

1. **O administrador conecta o assistente pelo teclado:** "Conectar agentes, 1 desconectado" abre
   o diálogo com o aviso de "Admin sem conectados"; Enter em "Conectar" o desabilita (Conectando,
   com a Server Action atrasada) e termina com "Desconectar"; a seção passa a "Gerenciar agentes",
   com a linha; a outra Pessoa vê a linha ao recarregar.
2. **Quem perdeu o papel recebe o erro:** o papel sai do banco com o diálogo aberto; "Conectar"
   mostra "Só administradores conectam agentes", e o Agente continua desconectado.
3. **A falha mostra o erro e não muda nada:** a Server Action responde 500; "Não foi possível
   conectar o agente", e o Agente continua desconectado.

Acessibilidade (`acessibilidade/agentes-admin-sem-violacoes.spec.ts`): o diálogo do administrador,
nos dois temas, sem violações do axe.

## F10-T07 · Desconectar um Agente (`agentes/desconectar-agente.spec.ts`)

1. **O administrador desconecta pelo teclado:** com uma Mensagem antiga que menciona o Agente,
   "Desconectar" abre a confirmação com o foco em "Cancelar"; Esc e "Cancelar" fecham sem mudar
   nada; confirmar mostra "Enviando" (Server Action atrasada), fecha, e o foco vai para o
   "Conectar" da linha; a linha some da barra lateral, a Mensagem antiga continua, e a outra
   Pessoa não vê a linha ao recarregar.
2. **A falha mantém o Agente conectado:** a Server Action responde 500; a confirmação fecha e o
   toast "Não foi possível desconectar o agente" aparece.
3. **Quem perdeu o papel recebe o erro:** "Só administradores desconectam agentes", e o Agente
   continua conectado.

Acessibilidade (`acessibilidade/desconectar-agente-sem-violacoes.spec.ts`): a confirmação, nos dois
temas, sem violações do axe. Os testes de acessibilidade da F10 esperam as transições de cor da
troca de tema antes de medir o contraste.

## F10-T08 · Mudança de conexão em tempo real (`agentes/tempo-real.spec.ts`)

1. **A outra Pessoa vê a mudança sem recarregar:** com o diálogo dela aberto em "Não conectado", o
   administrador conecta; o diálogo dela passa a "Conectado" e a linha aparece na barra lateral;
   quando ele desconecta, a linha some.
2. **A reconexão relê a lista:** o Agente é conectado direto no banco, sem evento, com a aba fora
   do ar; quando a rede volta, a linha aparece sem recarregar.

O chip do Agente virando texto comum sem recarregar fica com a F10-T09 (CA7 dela), porque a 09
ainda não estava concluída.

## F10-T09 · Mencionar um Agente conectado (`agentes/mencionar-agente.spec.ts`)

1. **O Agente aparece no autocompletar e a Menção vira chip para todos:** `@ass` mostra o Agente,
   depois dos Membros e ativo; Enter insere `@assistente`; a Mensagem enviada mostra o chip para as
   duas Pessoas; Enter no chip abre o diálogo "Agentes"; desconectado, ao recarregar, o chip vira
   texto comum e o Agente sai do autocompletar.
2. **O chip vira texto comum sem recarregar depois de desconectar** (a 08 já estava concluída).

Acessibilidade (`acessibilidade/mencionar-agente-sem-violacoes.spec.ts`): o autocompletar com o
Agente, nos dois temas, sem violações do axe.

O teste "Tab escolhe e as setas mudam a Pessoa destacada" (`conversa/mencionar.spec.ts`, F06) conta
as opções com o `@` vazio, e os Agentes conectados entram nela: ele passou a segurar a trava, com o
`assistente` desconectado.
