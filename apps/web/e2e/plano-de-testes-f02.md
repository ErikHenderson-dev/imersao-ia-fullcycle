# Plano de testes da F02 · Mensagens em canal público

Escrito pelo fluxo da skill `playwright-cli` (planejar, gerar e corrigir), no contêiner `e2e`.
O que é coberto é da spec da F02 ([spec.md](../../../docs/funcionalidades/02-mensagens-em-canal-publico/spec.md),
"Decisões de teste"); este plano é dono dos passos de cada cenário.

## Visão geral

O `playwright.config.ts` fixa o fuso do navegador em `America/Sao_Paulo`, o fuso padrão, e as horas
esperadas nos testes ficam nele.

A Pessoa vê os Canais públicos de que é Membro na barra lateral, abre um, lê as Mensagens e envia
outras. Cada teste cria a própria Pessoa pela fixture `person` e os próprios Canais, direto no
banco, com nome de prefixo `e2e-` e só as participações que o teste passa (`memberChannel` ou
`insertChannel`). As Mensagens com datas conhecidas vêm de `insertMessages`.

## Cenários

### 1. Abrir um Canal

**Seed:** `e2e/seed.spec.ts`

#### 1.1. abrir-canal-pela-barra-lateral

**File:** `e2e/conversa/abrir-canal-pela-barra-lateral.spec.ts`

**Steps:**
  1. Logada, com dois Canais (`e2e-a-…` e `e2e-b-…`), abrir `/`
    - expect: a seção "Canais" lista os dois, em ordem alfabética
    - expect: a barra lateral não tem "Adicionar canal", "Mensagens diretas" nem "Agentes"
  2. Clicar no segundo Canal
    - expect: a URL é `/conversas/<id>` e o título é o nome do Canal

#### 1.2. abrir-canal-pelo-teclado

**File:** `e2e/conversa/abrir-canal-pelo-teclado.spec.ts`

**Steps:**
  1. Com o foco no primeiro Canal da barra lateral, apertar Tab
    - expect: o foco está no segundo Canal
  2. Apertar Enter
    - expect: a URL é a do segundo Canal e o título é o nome dele

#### 1.3. conversa-nao-encontrada

**File:** `e2e/conversa/conversa-nao-encontrada.spec.ts`

**Steps:**
  1. Logada, abrir `/conversas/<uuid que não existe>`
    - expect: "Conversa não encontrada" e "Ela não existe ou você não participa dela."
  2. Clicar em "Voltar ao início"
    - expect: a Home vazia, porque a Pessoa não é Membro de nenhum Canal

### 2. Ler as Mensagens

#### 2.1. ler-as-mensagens-recentes

**File:** `e2e/conversa/ler-as-mensagens-recentes.spec.ts`

**Steps:**
  1. Abrir um Canal com o Tópico "Conversas do time" e três Mensagens de "Bruno Lima"
    - expect: o título com o nome do Canal e o Tópico
    - expect: três itens na lista "Mensagens em #<nome>", com nome, hora no fuso padrão (08:40) e texto
    - expect: a última Mensagem visível e o foco na caixa de mensagem

#### 2.2. mensagens-agrupadas-por-dia

**File:** `e2e/conversa/mensagens-agrupadas-por-dia.spec.ts`

**Steps:**
  1. Abrir um Canal com uma Mensagem de ontem e três de hoje da Pessoa (meio-dia, +2 min, +30 min)
    - expect: 4 itens, e os divisores "Ontem" e "Hoje" na lista
    - expect: a de +2 min é compacta, sem o nome; a de +30 min volta à forma completa

#### 2.3. links-e-texto-puro

**File:** `e2e/conversa/links-e-texto-puro.spec.ts`

**Steps:**
  1. Abrir um Canal com "Veja https://example.com/docs." e um texto com `<b>` e `<img onerror>`
    - expect: o link `https://example.com/docs`, sem o ponto, com `target="_blank"` e `rel="noopener noreferrer"`
    - expect: a marcação aparece como texto, sem `<b>` nem `<img>` na lista, e o `onerror` não roda

#### 2.4. hora-no-fuso-do-navegador

**File:** `e2e/conversa/hora-no-fuso-do-navegador.spec.ts`

**Steps:**
  1. Com o navegador em `Asia/Tokyo`, abrir um Canal com uma Mensagem às 11:40 UTC
    - expect: o cookie `fc_tz` vale `Asia/Tokyo`, e a hora é 20:40
  2. Recarregar
    - expect: a hora continua 20:40, sem aviso de hidratação no console

### 3. Enviar uma Mensagem

#### 3.1. enviar-mensagem

**File:** `e2e/conversa/enviar-mensagem.spec.ts`

**Steps:**
  1. Escrever "linha um", Shift+Enter, "linha dois" e Enter
    - expect: a última Mensagem tem o nome da Pessoa e as duas linhas
    - expect: a caixa está vazia
  2. Recarregar a página
    - expect: a Mensagem continua na lista

#### 3.2. envio-com-sessao-revogada

**File:** `e2e/conversa/envio-com-sessao-revogada.spec.ts`

**Steps:**
  1. Com o Canal aberto, revogar as Sessões da Pessoa no banco, escrever e apertar Enter
    - expect: a URL é `/entrar?para=%2Fconversas%2F<id>`

#### 3.3. limite-de-caracteres

**File:** `e2e/conversa/limite-de-caracteres.spec.ts`

**Steps:**
  1. Com a caixa vazia
    - expect: "Enviar mensagem" desabilitado
  2. Preencher 4001 emojis
    - expect: "1 caractere acima do limite", o botão desabilitado, e Enter não envia
  3. Preencher 4010 letras e depois 4000
    - expect: "10 caracteres acima do limite"; com 4000, o contador some e o botão habilita

#### 3.4. mensagem-enviando

**File:** `e2e/conversa/mensagem-enviando.spec.ts`

**Steps:**
  1. Com o Server Action segurado por `page.route`, enviar
    - expect: a última Mensagem com `data-status="sending"` e a caixa vazia
  2. Liberar o envio
    - expect: o mesmo item passa a `data-status="sent"`

#### 3.5. envios-em-sequencia

**File:** `e2e/conversa/envios-em-sequencia.spec.ts`

**Steps:**
  1. Enviar "um", "dois" e "três" seguidos
    - expect: as três na ordem, gravadas
  2. Recarregar
    - expect: a mesma ordem

#### 3.6. falha-no-envio

**File:** `e2e/conversa/falha-no-envio.spec.ts`

**Steps:**
  1. Com o Server Action abortado, enviar duas Mensagens
    - expect: as duas com "Não foi possível enviar."
  2. Liberar a rota e "Tentar de novo" na primeira
    - expect: gravada, sem o aviso, e uma linha só no banco
  3. "Descartar" na segunda
    - expect: ela sai da lista e não está no banco
  4. Abortar de novo, enviar uma terceira e recarregar
    - expect: só a primeira continua na lista

### 4. Canal ao entrar e endereço do Canal

#### 4.1. home-abre-o-primeiro-canal

**File:** `e2e/conversa/home-abre-o-primeiro-canal.spec.ts`

**Steps:**
  1. Logada, com dois Canais, abrir `/`
    - expect: a URL é a do primeiro Canal em ordem alfabética

#### 4.1.1. home-abre-a-ultima-conversa

**File:** `e2e/conversa/home-abre-a-ultima-conversa.spec.ts`

**Steps:**
  1. Com dois Canais, abrir o segundo
    - expect: o cookie `fc_last_conversation` com o id dele, `Path=/`, `SameSite=Lax` e 400 dias
  2. Abrir a Home
    - expect: a URL é a do segundo Canal

#### 4.1.2. home-ignora-conversa-fora-da-lista

**File:** `e2e/conversa/home-ignora-conversa-fora-da-lista.spec.ts`

**Steps:**
  1. Com dois Canais e um cookie com uma Conversa que não está na lista, abrir a Home
    - expect: a URL é a do primeiro Canal em ordem alfabética

#### 4.2. entrar-pelo-endereco-do-canal

**File:** `e2e/conversa/entrar-pelo-endereco-do-canal.spec.ts`

**Steps:**
  1. Sem Sessão, abrir `/conversas/<id>`
    - expect: a URL é `/entrar?para=%2Fconversas%2F<id>`
  2. Entrar
    - expect: a URL é a do Canal e o título é o nome dele

#### 4.3. voltar-e-avancar

**File:** `e2e/conversa/voltar-e-avancar.spec.ts`

**Steps:**
  1. Abrir o primeiro Canal e trocar para o segundo pela barra lateral
  2. Voltar no navegador
    - expect: o primeiro Canal
  3. Avançar no navegador
    - expect: o segundo Canal

#### 4.4. reabrir-canal-pela-barra-lateral

**File:** `e2e/conversa/reabrir-canal-pela-barra-lateral.spec.ts`

**Steps:**
  1. Abrir o primeiro Canal e alternar com o segundo pela barra lateral, duas vezes
    - expect: a cada troca, a URL, o título e a caixa de mensagem são os do Canal aberto
    - expect: nenhum erro na página

### 5. Histórico até a primeira Mensagem

Os testes desta seção esperam o histórico hidratado (`readyHistory`, que espera o `data-ready`)
antes de rolar, e montam o histórico com `insertHistory` ("Mensagem 1" a "Mensagem N").

#### 5.1. rolar-ate-o-comeco

**File:** `e2e/conversa/rolar-ate-o-comeco.spec.ts`

**Steps:**
  1. Abrir um Canal com 75 Mensagens
    - expect: 50 itens, o último "Mensagem 75"
  2. Rolar até o topo
    - expect: a página anterior chega pela rota `/api/conversations/<id>/messages?before=`
    - expect: 75 itens, o primeiro "Mensagem 1"
    - expect: a "Mensagem 26", que estava no topo, continua no mesmo lugar da tela
  3. Rolar até o topo de novo
    - expect: "Este é o começo do canal #<nome>"

#### 5.2. carregar-anteriores-pelo-teclado

**File:** `e2e/conversa/carregar-anteriores-pelo-teclado.spec.ts`

**Steps:**
  1. Sem o IntersectionObserver (só o teclado carrega), abrir um Canal com 60 Mensagens
  2. Shift+Tab da caixa de mensagem
    - expect: o foco está em "Carregar mensagens anteriores"
  3. Shift+Tab de novo, End e PageUp
    - expect: o foco está na área do histórico, e ela rola para cima
  4. Tab e Enter
    - expect: 60 itens e o começo do Canal
    - expect: o foco está na área do histórico, porque o botão saiu com a última página

#### 5.3. falha-ao-carregar-anteriores

**File:** `e2e/conversa/falha-ao-carregar-anteriores.spec.ts`

**Steps:**
  1. Com a rota das anteriores abortada por `page.route`, rolar até o topo
    - expect: "Carregar mensagens anteriores" visível, fora de carga, e os 50 itens mantidos
  2. Liberar a rota e clicar no link
    - expect: 60 itens e o começo do Canal

#### 5.4. canal-sem-mensagens

**File:** `e2e/conversa/canal-sem-mensagens.spec.ts`

**Steps:**
  1. Abrir um Canal sem Mensagens
    - expect: "Este é o começo do canal #<nome>" com o Tópico, nenhum item e nenhum link de anteriores

#### 5.5. anteriores-com-sessao-revogada

**File:** `e2e/conversa/anteriores-com-sessao-revogada.spec.ts`

**Steps:**
  1. Com 60 Mensagens, revogar a Sessão e rolar até o topo
    - expect: a URL é `/entrar?para=%2Fconversas%2F<id>`

#### 5.6. enviar-e-carregar-anteriores

**File:** `e2e/conversa/enviar-e-carregar-anteriores.spec.ts`

**Steps:**
  1. Com 60 Mensagens, enviar "Recém-enviada"
    - expect: a última Mensagem é a enviada
  2. Rolar até o topo
    - expect: 61 itens, e a enviada continua a última

### 6. Acessibilidade

#### 6.1. conversa-sem-violacoes

**File:** `e2e/acessibilidade/conversa-sem-violacoes.spec.ts`

**Steps:**
  1. Abrir um Canal com Mensagens de duas Pessoas e analisar com o axe
    - expect: nenhuma violação

### 7. Barra lateral

**Seed:** `e2e/seed.spec.ts`

#### 7.1. secao-canais-recolhe

**File:** `e2e/conversa/secao-canais-recolhe.spec.ts`

**Steps:**
  1. Clicar no título "Canais"
    - expect: `aria-expanded="false"` e o Canal some
  2. Enter no título, pelo teclado
    - expect: `aria-expanded="true"` e o Canal volta

#### 7.2. linha-ativa

**File:** `e2e/conversa/linha-ativa.spec.ts`

**Steps:**
  1. Com dois Canais, abrir o primeiro
    - expect: só a linha dele com `aria-current="page"`
  2. Trocar para o segundo pela barra lateral
    - expect: a linha ativa passa a ser a do segundo
  3. Voltar no navegador
    - expect: a linha ativa volta a ser a do primeiro

### 8. Gaveta em telas estreitas

**Seed:** `e2e/seed.spec.ts`

#### 8.1. gaveta-em-tela-estreita

**File:** `e2e/conversa/gaveta-em-tela-estreita.spec.ts`

**Steps:**
  1. Em 767, abrir a Conversa
    - expect: o botão "Abrir navegação" aparece, e o Rail e a barra lateral não
  2. Abrir a gaveta
    - expect: o diálogo "Navegação" com o Rail e os Canais
  3. Esc
    - expect: a gaveta fecha e o foco volta ao botão
  4. Abrir e clicar fora
    - expect: a gaveta fecha
  5. Abrir e escolher outro Canal
    - expect: a URL muda, a gaveta fecha e o foco vai para a caixa de mensagem

#### 8.2. sem-gaveta-em-tela-larga

**File:** `e2e/conversa/gaveta-em-tela-estreita.spec.ts`

**Steps:**
  1. Em 1440, abrir a Conversa
    - expect: sem o botão, com o Rail e a barra lateral

#### 8.2.1. gaveta-fecha-ao-alargar

**File:** `e2e/conversa/gaveta-em-tela-estreita.spec.ts`

**Steps:**
  1. Em 767, abrir a gaveta e alargar a janela para 1440
    - expect: a gaveta fecha, e a caixa de mensagem recebe o clique e o foco

#### 8.3. gaveta-na-home-vazia

**File:** `e2e/conversa/gaveta-na-home-vazia.spec.ts`

**Steps:**
  1. Sem Canais, em 767, abrir a Home e o botão da gaveta
    - expect: a gaveta com a seção "Canais"

#### 8.4. gaveta-sem-violacoes

**File:** `e2e/acessibilidade/gaveta-sem-violacoes.spec.ts`

**Steps:**
  1. Em 767, abrir a gaveta e analisar com o axe
    - expect: nenhuma violação

