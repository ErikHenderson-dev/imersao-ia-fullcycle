# Plano de testes da F05 · Busca de pessoas, perfil e conversa direta

Escrito pelo fluxo da skill `playwright-cli` (planejar, gerar e corrigir), no contêiner `e2e`.
O que é coberto é da spec da F05 ([spec.md](../../../docs/funcionalidades/05-busca-de-pessoas-perfil-e-conversa-direta/spec.md),
"Decisões de teste"); este plano é dono dos passos de cada cenário. As Pessoas e os Canais são
criados direto no banco, com cargo e telefone quando o cenário pede.

## Cenários

### 1. Ver um Perfil (F05-T02)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/perfil/ver-perfil.spec.ts`

1. **mostra o Perfil de outra Pessoa:** clicar no nome da autora de uma Mensagem; o painel mostra
   nome, cargo, `@usuário`, "Mensagem" desabilitado, o e-mail como `mailto:` e o telefone, com o
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
