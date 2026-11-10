# Plano de testes da F05 · Busca de pessoas, perfil e conversa direta

Escrito pelo fluxo da skill `playwright-cli` (planejar, gerar e corrigir), no contêiner `e2e`.
O que é coberto é da spec da F05 ([spec.md](../../../docs/funcionalidades/05-busca-de-pessoas-perfil-e-conversa-direta/spec.md),
"Decisões de teste"); este plano é dono dos passos de cada cenário. As Pessoas e os Canais são
criados direto no banco, com cargo e telefone quando o cenário pede.

## Cenários

### 1. Ver um Perfil (F05-T02)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/perfil/ver-perfil.spec.ts`

1. **mostra o Perfil de outra Pessoa:** clicar no nome da autora de uma Mensagem; o painel mostra
   nome, cargo, `@usuário`, "Mensagem", o e-mail como `mailto:` e o telefone, com o
   foco em "Fechar perfil".
2. **esconde cargo e telefone que não existem:** o Perfil de quem não tem os dois não mostra
   "Telefone".
3. **abre o próprio Perfil pelo menu do avatar, sem Editar perfil:** pelo teclado, Enter no
   avatar e Enter em "Perfil"; o foco vai para o painel.
4. **abre pela lista de Membros:** escolher a Pessoa fecha o diálogo e abre o painel; Esc fecha e
   devolve o foco ao botão de Membros.
5. **mostra Pessoa não encontrada:** a leitura do Perfil responde 404 pelo `page.route`.
6. **tenta de novo depois da falha ao carregar:** a primeira leitura responde 502; "Tentar de
   novo" carrega o Perfil.
7. **a Sessão vencida leva a Entrar ao abrir o Perfil:** com as Sessões apagadas no banco.

### 2. Painel de perfil (F05-T02)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/perfil/painel-de-perfil.spec.ts`

1. **continua aberto ao trocar de Conversa e troca o conteúdo ao abrir outro Perfil.**
2. **Esc fecha e devolve o foco:** aberto pelo teclado no nome da autora, o foco volta a ele.
3. **sobrepõe a Conversa em telas estreitas:** em 1024 px o painel tem 384 px e cobre a Conversa;
   em 600 px ocupa a largura toda.

### 3. Acessibilidade (F05-T02)

**File:** `e2e/acessibilidade/perfil-sem-violacoes.spec.ts`: o axe sem violações com o Perfil
completo aberto.

### 4. Hora local no Perfil (F05-T03)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/perfil/hora-local.spec.ts`, com o navegador em
`Asia/Tokyo`, longe do fuso padrão do servidor.

1. **grava o fuso do navegador ao abrir o chat e mostra a hora no fuso da Pessoa:** depois de
   entrar, o banco tem `Asia/Tokyo`; o próprio Perfil mostra a hora de Tóquio com "no horário
   local".
2. **sem fuso, a linha não aparece:** o Perfil de quem nunca abriu o chat.
3. **a recusa ao gravar o fuso não aparece nem repete:** fora de "Entrar", as Server Actions
   respondem 500; uma chamada por carga da página, nenhum aviso na tela e nada gravado.

### 5. Abrir a Conversa direta pelo Perfil (F05-T04)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/conversa-direta/abrir-pelo-perfil.spec.ts`

1. **abre a Conversa direta pelo Perfil e reabrir cai na mesma:** "Mensagem" pelo teclado abre a
   Conversa, com o foco em "Mensagem para Regina", o começo da conversa direta, a linha em
   "Mensagens diretas" e nenhum botão de Membros; reabrir pelo Perfil cai no mesmo endereço, sem
   linha repetida.
2. **a Conversa consigo mesma aparece com você:** pelo próprio Perfil.
3. **o cabeçalho abre o Perfil da outra Pessoa.**
4. **a Conversa aparece em outra aba sem recarregar.**
5. **a falha ao abrir aparece no painel e tenta de novo:** a Server Action responde 500 uma vez.

**File:** `e2e/acessibilidade/conversa-direta-sem-violacoes.spec.ts`: o axe na Conversa direta.


### 6. A outra Pessoa recebe a Conversa direta na primeira Mensagem (F05-T05)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/conversa-direta/primeira-mensagem.spec.ts`, com duas
Pessoas em dois contextos do navegador.

1. **a Conversa só aparece para a outra Pessoa na primeira Mensagem:** aberta sem Mensagem, a
   Conversa não aparece na barra lateral da outra e o endereço mostra "Conversa não encontrada";
   depois da primeira Mensagem, a Conversa aparece na barra lateral dela sem recarregar e sem abrir
   sozinha; ela abre, vê a Mensagem e responde, e a resposta chega em tempo real.
