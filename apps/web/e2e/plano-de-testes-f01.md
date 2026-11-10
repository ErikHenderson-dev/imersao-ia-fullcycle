# Plano de testes da F01 · Login e sessão

Escrito pelo fluxo da skill `playwright-cli` (planejar, gerar e corrigir), no contêiner `e2e`.
O que é coberto é da spec da F01 ([spec.md](../../../docs/funcionalidades/01-login-e-sessao/spec.md),
"Decisões de teste"); este plano é dono dos passos de cada cenário.

## Visão geral

A Pessoa entra com e-mail e senha da conta que a empresa criou, cai na Home, continua logada
enquanto a Sessão vale e sai pelo menu do avatar. Os testes rodam só no Chromium, contra o
ambiente de desenvolvimento de pé (web, API do chat e banco `chat`). Cada teste cria a própria
Pessoa pela fixture `person`; os que partem de alguém logado usam `loggedInPage`.

## Cenários

### 1. Entrar

**Seed:** `e2e/seed.spec.ts`

#### 1.1. entrar-ate-a-home

**File:** `e2e/login/entrar-ate-a-home.spec.ts`

**Steps:**
  1. Abrir `/entrar`
    - expect: o foco está no campo E-mail
  2. Preencher E-mail e Senha da Pessoa e clicar em "Entrar"
    - expect: a URL é `/`
    - expect: a navegação "Seções" tem o "FC", o link "Início" ativo e o botão do avatar, "Menu de <nome>", com as iniciais dela
    - expect: a barra lateral tem o cabeçalho "Full Cycle"
    - expect: o título "Nenhuma conversa ainda" aparece
  3. Abrir `/` em outra página do mesmo navegador
    - expect: a URL continua `/`, já logada

#### 1.2. credenciais-incorretas

**File:** `e2e/login/credenciais-incorretas.spec.ts`

**Steps:**
  1. Abrir `/entrar`, preencher o E-mail da Pessoa e uma senha errada
  2. Clicar em "Entrar", com o envio atrasado de propósito
    - expect: durante o envio, o botão "Entrar" fica desabilitado e ocupado
    - expect: a mensagem "E-mail ou senha incorretos. Confira os dados e tente de novo." aparece abaixo da Senha
    - expect: a Senha fica vazia, inválida e com o foco
    - expect: o E-mail continua preenchido

#### 1.3. entrar-pelo-teclado

**File:** `e2e/login/entrar-pelo-teclado.spec.ts`

**Steps:**
  1. Abrir `/entrar`
    - expect: o foco está no E-mail
  2. Digitar o e-mail, Tab, digitar a senha, Tab
    - expect: o foco passa pela Senha e chega ao botão "Entrar"
  3. Shift+Tab até a Senha e Enter
    - expect: a URL é `/` e a Home aparece

#### 1.4. entrar-antes-da-hidratacao

**File:** `e2e/login/entrar-antes-da-hidratacao.spec.ts`

**Steps:**
  1. Abrir `/entrar` com os bundles do Next bloqueados (o React não hidrata)
  2. Enviar com a senha errada
    - expect: a página volta a `/entrar` e a mensagem de dados incorretos aparece (o resultado vem num cookie de vida curta, e não na URL)
  3. Enviar com a senha certa
    - expect: a URL é `/` (o envio nativo é um POST para a Server Action, sem a senha na URL)

### 2. Sem Sessão

**Seed:** `e2e/seed.spec.ts`

#### 2.1. redireciona-sem-sessao

**File:** `e2e/login/redireciona-sem-sessao.spec.ts`

**Steps:**
  1. Sem cookie, abrir `/`
    - expect: a URL é `/entrar`

#### 2.2. sessao-desconhecida-volta-para-entrar

**File:** `e2e/login/sessao-desconhecida-volta-para-entrar.spec.ts`

**Steps:**
  1. Com um cookie de sessão cujo token a API não conhece, abrir `/?aba=fixados`
    - expect: a URL é `/entrar?para=%2F%3Faba%3Dfixados`
    - expect: o cookie de sessão deixa de existir

### 3. Erros ao entrar

**Seed:** `e2e/seed.spec.ts`

#### 3.1. erros-de-preenchimento

**File:** `e2e/login/erros-de-preenchimento.spec.ts`

**Steps:**
  1. Abrir `/entrar` e clicar em "Entrar" com os dois campos vazios
    - expect: "Informe um e-mail válido, como nome@empresa.com." abaixo do E-mail e "Informe sua senha." abaixo da Senha
    - expect: o foco vai para o E-mail, que fica inválido e descrito pela mensagem dele
  2. Preencher um e-mail fora do formato e uma senha, e enviar com Enter
    - expect: só a mensagem do E-mail, com o foco no E-mail
  3. Preencher `ana@empresa..com` e, depois, `ana@empresa/com.br`, e enviar cada um
    - expect: a mensagem do E-mail, com o foco no E-mail
  4. Preencher um e-mail válido, apagar a senha e enviar
    - expect: só a mensagem da Senha, com o foco na Senha
    - expect: nenhum envio saiu para o servidor em todo o cenário

#### 3.2. tentativas-demais

**File:** `e2e/login/tentativas-demais.spec.ts`

**Steps:**
  1. Abrir `/entrar` e errar a senha da Pessoa 5 vezes seguidas
    - expect: cada tentativa mostra "E-mail ou senha incorretos."
  2. Tentar de novo com a senha certa
    - expect: "Muitas tentativas de entrar. Aguarde alguns minutos e tente de novo." no `alert` do formulário
    - expect: o E-mail e a Senha continuam preenchidos

A falha no envio (API do chat parada) é verificada pelo `playwright-cli` e registrada na pasta da
F01-T04 (`falha-no-envio.md`).

### 4. Acessibilidade

**Seed:** `e2e/seed.spec.ts`

#### 4.1. entrar-e-home-sem-violacoes

**File:** `e2e/acessibilidade/entrar-e-home-sem-violacoes.spec.ts`

**Steps:**
  1. Abrir `/entrar`
    - expect: o axe não encontra violações
  2. Enviar com os campos vazios
    - expect: o axe não encontra violações na tela com os erros
  3. Entrar com a Pessoa
    - expect: o axe não encontra violações na Home

### 5. Voltar para onde ia

**Seed:** `e2e/seed.spec.ts`

#### 5.1. entrar-por-link-profundo

**File:** `e2e/login/entrar-por-link-profundo.spec.ts`

**Steps:**
  1. Sem Sessão, abrir `/canais/geral?aba=fixados`
    - expect: a URL é `/entrar?para=%2Fcanais%2Fgeral%3Faba%3Dfixados`
  2. Entrar com a Pessoa
    - expect: a URL é `/canais/geral?aba=fixados` (a rota ainda não existe na F01; o destino basta)

#### 5.2. para-externo-cai-na-home

**File:** `e2e/login/para-externo-cai-na-home.spec.ts`

**Steps:** um caso para cada valor de `para` que a regra de "Voltar para onde ia" recusa (LLD, "Cliente", "Sessão no cliente"): `//outro-site`, `https://outro-site`, `/\outro-site`, o valor único `/` + tabulação + `/outro-site` (no teste, `"/\t/outro-site"`) e `/a/..//outro-site`. O caminho interno aceito está no 5.1.
  1. Abrir `/entrar?para=<valor>` e entrar com a Pessoa
    - expect: a URL é `/` e a Home aparece

#### 5.3. logada-em-entrar-vai-para-a-home

**File:** `e2e/login/logada-em-entrar-vai-para-a-home.spec.ts`

**Steps:**
  1. Logada, abrir `/entrar`
    - expect: a URL é `/` e a Home aparece

#### 5.4. sessao-desconhecida-em-entrar-mostra-o-formulario

**File:** `e2e/login/sessao-desconhecida-em-entrar-mostra-o-formulario.spec.ts`

**Steps:**
  1. Com um cookie de sessão que a API não conhece, abrir `/entrar`
    - expect: a URL continua `/entrar`, com o formulário
    - expect: o cookie de sessão deixa de existir

#### 5.5. verificacao-falhou-mostra-o-formulario

**File:** `e2e/login/verificacao-falhou-mostra-o-formulario.spec.ts`

**Steps:**
  1. Logada, abrir `/entrar?verificacao=falhou&para=%2F%3Faba%3Dx` (a marca que a rota do BFF põe quando a reconferência falha)
    - expect: o formulário aparece, sem verificar o cookie de novo
    - expect: a marca sai da URL, que fica `/entrar?para=%2F%3Faba%3Dx`

### 6. Continuar logada e Sessão que acaba

**Seed:** `e2e/seed.spec.ts`

#### 6.1. segunda-aba-ja-logada

**File:** `e2e/sessao/segunda-aba-ja-logada.spec.ts`

**Steps:**
  1. Com a Pessoa logada numa aba, abrir `/` em outra aba do mesmo navegador
    - expect: a URL é `/` e a Home aparece

#### 6.2. navegador-reaberto-continua-logado

**File:** `e2e/sessao/navegador-reaberto-continua-logado.spec.ts`

**Steps:**
  1. Guardar os cookies e fechar o navegador
  2. Reabrir num contexto novo com os cookies guardados e abrir `/`
    - expect: a URL é `/` e a Home aparece

#### 6.3. sessao-revogada-volta-para-entrar

**File:** `e2e/sessao/sessao-revogada-volta-para-entrar.spec.ts`

**Steps:**
  1. Com a Pessoa logada, revogar as Sessões dela no banco
  2. Navegar para `/`
    - expect: a URL é `/entrar`, com o formulário

### 7. Sair

**Seed:** `e2e/seed.spec.ts`

#### 7.1. menu-do-avatar

**File:** `e2e/sair/menu-do-avatar.spec.ts`

**Steps:**
  1. Logada, focar o avatar ("Menu de <nome>") e apertar Enter
    - expect: o menu abre com o nome da Pessoa e um único item, "Sair do Full Cycle"
  2. Apertar Esc
    - expect: o menu fecha e o foco volta ao avatar
  3. Clicar no avatar
    - expect: o menu abre de novo

#### 7.2. sair-pelo-teclado

**File:** `e2e/sair/sair-pelo-teclado.spec.ts`

**Steps:**
  1. Do link "Início", Tab até o avatar, passando por "Atividade" e pelo botão de tema
  2. Enter abre o menu; End foca "Sair do Full Cycle", o último item; Enter
    - expect: a URL é `/entrar`, o cookie de sessão não existe e a Sessão foi apagada no banco

#### 7.3. sair-com-a-api-recusando

**File:** `e2e/sair/sair-com-a-api-recusando.spec.ts`

**Steps:**
  1. Logada, apagar a Sessão no banco (a API vai recusar a saída)
  2. Sair pelo menu
    - expect: a URL é `/entrar` e o cookie de sessão não existe

#### 7.4. outra-aba-vai-para-entrar

**File:** `e2e/sair/outra-aba-vai-para-entrar.spec.ts`

**Steps:**
  1. Logada, abrir a Home numa segunda aba
  2. Sair na primeira aba
    - expect: a segunda aba vai para `/entrar` sozinha, pelo tempo real (desde a F03; antes, na
      próxima navegação)

#### 7.5. voltar-depois-de-sair

**File:** `e2e/sair/voltar-depois-de-sair.spec.ts`

**Steps:**
  1. Logada, recarregar a Home
    - expect: a resposta tem `Cache-Control` com `no-store`
  2. Sair pelo menu
  3. Voltar pelo histórico
    - expect: a URL é `/entrar` e a Home não aparece
