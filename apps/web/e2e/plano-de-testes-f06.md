# Plano de testes da F06 · Ações na mensagem

Escrito pelo fluxo da skill `playwright-cli` (planejar, gerar e corrigir), no contêiner `e2e`.
O que é coberto é da spec da F06 ([spec.md](../../../docs/funcionalidades/06-acoes-na-mensagem/spec.md),
"Decisões de teste"); este plano é dono dos passos de cada cenário. As Pessoas, os Canais e as
Mensagens são criados direto no banco.

## Cenários

### 1. Barra de ações, menu e copiar o texto (F06-T02)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/conversa/acoes-na-mensagem.spec.ts`

Uma Mensagem da Pessoa logada, com uma quebra de linha e um link, e as permissões
`clipboard-read` e `clipboard-write` concedidas ao contexto.

1. **mostra a barra no hover e no foco:** a barra começa com opacidade zero; o mouse sobre a
   Mensagem a mostra; "Mais ações" abre o menu com "Copiar texto"; sem hover e sem foco ela some, e
   o foco em "Copiar texto" a mostra de novo.
2. **mostra a dica dos botões da barra:** o mouse sobre "Copiar texto" mostra a dica com o rótulo.
3. **copia o texto de uma Mensagem pela barra e pelo menu:** a área de transferência fica com o
   texto gravado, sem autor nem hora, e aparece "Texto copiado", que fecha pelo botão de fechar.
4. **mostra o erro quando o navegador recusa a cópia:** com `navigator.clipboard.writeText`
   rejeitando, aparece "Não foi possível copiar o texto".
5. **usa a barra e o menu só pelo teclado:** do link da Mensagem, Tab chega a "Copiar texto" e a
   "Mais ações"; Enter abre o menu com o foco no item; Esc fecha e devolve o foco; Espaço abre e
   Enter no item copia.
6. **a Mensagem com falha no envio não tem barra:** com o envio abortado, a Mensagem com falha
   não tem "Copiar texto" nem "Mais ações".

**File:** `e2e/acessibilidade/acoes-na-mensagem-sem-violacoes.spec.ts`

7. **a barra e o menu não têm violações de acessibilidade:** o axe sem violações com a barra à
   vista e com o menu aberto.

### 2. Editar a própria Mensagem (F06-T03)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/conversa/editar-mensagem.spec.ts`

Duas Mensagens da Pessoa logada e uma de outra Pessoa num Canal em comum. A linha da Mensagem é
localizada pelo id, porque em edição o texto vai para a caixa.

1. **edita pela barra e cancela com Esc:** "Editar" põe o texto na caixa com o foco no fim; Esc
   cancela e devolve o foco a "Editar"; pelo menu, Shift+Enter quebra a linha e Enter salva, com
   "(editada)"; editar outra Mensagem fecha a primeira.
2. **não salva vazio nem acima do limite:** com espaços ou 4002 caracteres, Salvar fica desabilitado
   e Enter não fecha a caixa, com "2 caracteres acima do limite".
3. **mostra a falha e tenta de novo:** com a Server Action presa, Salvar fica ocupado; abortada,
   aparece "Não foi possível salvar a edição." com o texto mantido; com a rede de volta, "Tentar de
   novo" salva.
4. **edita só pelo teclado:** da caixa de mensagem, Shift+Tab chega a "Editar"; Enter abre a caixa,
   Enter salva e o foco volta a "Editar".
5. **a Mensagem de outra Pessoa não tem Editar:** nem na barra nem no menu.

**File:** `e2e/tempo-real/edicao-sem-recarregar.spec.ts`

6. **a edição aparece para a outra Pessoa sem recarregar:** duas Pessoas em dois contextos; a autora
   edita e a outra vê o texto novo e "(editada)".

**File:** `e2e/acessibilidade/edicao-sem-violacoes.spec.ts`

7. **a edição não tem violações de acessibilidade:** o axe com a caixa de edição aberta.

### 3. Apagar a própria Mensagem (F06-T04)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/conversa/apagar-mensagem.spec.ts`

Duas Mensagens da Pessoa logada, com uma de outra Pessoa entre elas, num Canal em comum. Com o
diálogo aberto, o resto da página fica escondido dos papéis, e a Mensagem é localizada pelo id.

1. **abre a confirmação com o foco em Cancelar e cancela:** "Mais ações" → "Apagar" abre "Apagar
   mensagem?" com a descrição e o texto; o clique fora não fecha; Esc fecha e a Mensagem continua.
2. **apaga e o foco vai para a seguinte:** a Mensagem sai, e o foco vai para o nome da autora da
   seguinte.
3. **apagar a última leva o foco à caixa de mensagem.**
4. **mostra a falha e tenta de novo:** com a Server Action presa, "Apagando"; abortada, o erro e a
   Mensagem continua; com a rede de volta, "Tentar de novo" apaga.
5. **apaga só pelo teclado:** Enter em "Mais ações", End até "Apagar", Enter; Tab de Cancelar a
   Apagar e Enter.
6. **a Mensagem de outra Pessoa não tem Apagar.**
7. **a edição aberta fecha quando a Mensagem é apagada em outra aba:** com o aviso "Essa mensagem
   foi apagada.".

**File:** `e2e/tempo-real/exclusao-sem-recarregar.spec.ts`

8. **a Mensagem apagada some para a outra Pessoa sem recarregar.**

**File:** `e2e/acessibilidade/apagar-sem-violacoes.spec.ts`

9. **a confirmação de apagar não tem violações de acessibilidade.**

### 4. Mencionar um Membro (F06-T05)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/conversa/mencionar.spec.ts`

Duas Pessoas num Canal em comum (Ana Souza, logada, e Bruno Lima).

1. **menciona pela lista só pelo teclado:** "Oi @bru" abre a lista com Bruno destacado; Enter
   escolhe sem enviar e põe "@usuario "; o envio mostra a Menção como botão.
2. **Tab escolhe e as setas mudam a Pessoa destacada:** "@" lista os dois Membros; seta para baixo
   destaca o segundo, e Tab o escolhe.
3. **o botão @ abre a lista:** insere " @" depois de "Oi", com o foco na caixa.
4. **Esc fecha a lista sem mudar o texto, e sem resultado ela fecha:** apagar o `@` e digitar de
   novo abre a lista outra vez.
5. **menciona na edição.**

**File:** `e2e/tempo-real/mencao.spec.ts`

6. **a Pessoa mencionada vê o destaque e abre o Perfil pela Menção:** o `@` de quem não é Membro
   fica como texto.
7. **a Menção acrescentada na edição destaca sem recarregar.**

**File:** `e2e/acessibilidade/mencoes-sem-violacoes.spec.ts`

8. **a lista de menções não tem violações de acessibilidade.**

### 5. Responder citando uma Mensagem (F06-T06)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/conversa/responder-citando.spec.ts`

Uma Mensagem de Bruno Lima e uma de Ana Souza (logada) num Canal em comum.

1. **responde citando só pelo teclado:** Enter em "Responder" põe a caixa em "Respondendo a Bruno
   Lima" com o foco nela; o envio mostra a Citação na Mensagem nova e limpa a caixa.
2. **Cancelar resposta e Esc desistem sem apagar o texto.**
3. **responder a outra troca a Citação.**
4. **a Citação apagada em outra aba sai da caixa, com aviso.**

**File:** `e2e/tempo-real/citacao.spec.ts`

5. **a Citação acompanha a edição e a exclusão da original:** duas Pessoas; a resposta da outra
   mostra o texto editado e, depois da exclusão, "Em resposta a uma mensagem apagada".

**File:** `e2e/acessibilidade/citacao-sem-violacoes.spec.ts`

6. **a caixa em Citando não tem violações de acessibilidade.**

Os testes da barra e do menu (F06-T02 a T04) passam a contar com "Responder" como a primeira ação.
