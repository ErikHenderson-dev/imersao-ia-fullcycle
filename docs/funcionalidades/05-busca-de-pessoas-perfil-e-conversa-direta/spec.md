# Spec · F05 · Busca de pessoas, perfil e conversa direta

2026-11-09 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F05 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

## Problema

A pessoa conversa em Canais, mas não tem como falar só com uma Pessoa nem saber quem é quem: a
Pessoa do chat tem só nome e e-mail, e o autor de uma Mensagem não leva a lugar nenhum (PRD, seção
1, "Resumo executivo").

## Solução

A Pessoa ganha `@usuário`, cargo, telefone e fuso. A busca da F04 passa a achar também pelo
`@usuário` e a servir ao diálogo "Nova conversa", e uma rota nova devolve o Perfil, mostrado num
painel ao lado da Conversa. Abrir uma Conversa direta busca ou cria a Conversa do par e torna quem
abriu Membro dela; a outra Pessoa vira Membro na primeira Mensagem
([ADR 0025](../../adr/0025-membro-da-conversa-direta-na-primeira-mensagem.md)), e a Conversa
direta entra na barra lateral dela pelo mesmo `conversation.member_added` da F04. Mensagens,
histórico, "digitando" e reconexão são os da F02 e da F03, sem mudança. O fluxo completo está no
PRD, seção 2, "Fluxo".

## Histórias de usuário

As histórias 1 a 7 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá. Esta spec acrescenta a de quem opera a instalação, que o PRD cobre em "Comando de
contas":

8. Como operação, quero informar o `@usuário`, o cargo e o telefone ao criar uma conta, e trocar o
   cargo e o telefone depois, para o Perfil mostrar dados certos até a F09.

## Decisões de implementação

### Pessoas (API do chat)

A tabela `people` ganha quatro colunas, `planejadas`:

| Coluna | Regra |
| --- | --- |
| `username` | Obrigatório e único. Letras de `a` a `z` sem acento, números, `.`, `_` e `-`, de 2 a 30 caracteres, começando e terminando com letra ou número, conferido também por um `CHECK` |
| `title` | Cargo, opcional, de 1 a 80 caracteres, numa linha só |
| `phone` | Telefone, opcional, de 1 a 30 caracteres, só dígitos, espaço, `+`, `-`, `(` e `)` |
| `time_zone` | Fuso IANA, opcional, aceito só se o `Intl.DateTimeFormat` do Node o reconhece |

- **`@usuário` das contas que já existem:** a migração cria a coluna, preenche e só então a torna
  obrigatória e única. O valor vem da parte do e-mail antes do `@`: minúsculas, sem acento, sem
  os caracteres fora da regra, sem os caracteres que não são letra ou número no
  começo e no fim, cortado para caber o sufixo. Quando repete, ganha `2`, `3` e assim por diante,
  pela ordem de criação da conta (o id, UUID v7), pulando um valor que já exista. Com menos de 2
  caracteres, vira `pessoa`, com o mesmo sufixo.
- **`@usuário` de uma conta nova:** o informado no comando de contas ou, sem ele, a mesma derivação,
  numa função pura da API, que a migração também usa. Um `@usuário` informado e já usado recusa a
  criação; o derivado ganha o sufixo.
- **O `@usuário` não muda** depois de gravado (PRD, "Regras desta funcionalidade").
- **Cargo e telefone vazios** são gravados como nulos.

### Conversa direta (API do chat)

A tabela `conversations` muda, `planejada`:

| Coluna ou regra | Mudança |
| --- | --- |
| `kind` | O `CHECK` aceita também `direct` |
| `name` e `topic` | Nulos na Conversa direta, por um `CHECK` |
| `direct_person_low_id` e `direct_person_high_id` | uuid, referência a `people`, apagar a Pessoa apaga a Conversa direta. Preenchidos só na Conversa direta, por um `CHECK`, com `low <= high`; na Conversa consigo mesma, os dois são a própria Pessoa |
| Unicidade | Parcial em (`direct_person_low_id`, `direct_person_high_id`) onde `kind = 'direct'`: uma Conversa direta por par |

- **Abrir uma Conversa direta:** uma transação só, sem a trava da participação em Canal público,
  porque não grava participação em Canal:
  1. Confere que `person_id` é de uma Pessoa; senão, `person_not_found`.
  2. Grava a Conversa do par, tolerando a que já existe (`ON CONFLICT DO NOTHING`), e lê a do par
     quando não gravou. Abrir pelas duas pontas ao mesmo tempo dá na mesma Conversa.
  3. Grava a participação de quem abriu, tolerando a que já existe.
  4. Responde 201 quando a Conversa foi criada agora, e 200 quando ela já existia.
- **Quem abriu passou a ser Membro agora** (Conversa nova, ou a outra ponta abrindo antes da
  primeira Mensagem): publica `conversation.member_added` depois do commit, pela regra da F04 (spec
  da F04, "Tempo real"), com `person_ids` de quem abriu. Já era Membro: nada é publicado.
- **Primeira Mensagem:** o envio passa a ser uma transação. Depois de gravar uma Mensagem nova numa
  Conversa direta, grava a participação da outra Pessoa do par, tolerando a que já existe. Se a
  gravou agora, depois do commit publica, nessa ordem e uma depois da outra, o
  `conversation.member_added`, com `person_ids` da outra Pessoa, e o `message.created`, para a aba
  dela ter a Conversa na lista antes da Mensagem. O reenvio idempotente não grava nem publica nada.
  A publicação do `member_added` é a do módulo de participação, que o envio passa a usar.
- **Adicionar a uma Conversa direta:** `members_not_editable` (409), pela regra da F04, que só
  aceita Canal privado.
- **Acesso:** a conferência de participação da F02 vale como está. Antes da primeira Mensagem, a
  outra Pessoa não é Membro e recebe `conversation_not_found`, como qualquer outra (ADR 0025).
- **A outra Pessoa na Conversa:** toda Conversa no REST e nos eventos ganha `counterpart`: `id`,
  `name` e `username` da outra Pessoa do par, a própria Pessoa na Conversa consigo mesma, e nulo nos
  Canais. As iniciais são calculadas na web, como as da `Person` da F01.
- **Lista de Conversas:** os Canais primeiro, pela ordem alfabética da F04 (spec da F04, "Ordem
  alfabética"), e depois as Conversas diretas, pela mesma ordem aplicada ao `counterpart.name`.

### Busca e Perfil (API do chat)

- **Busca:** a da F04 (spec da F04, "Busca de Pessoas") passa a achar o texto no nome ou no
  `username`, sem diferenciar maiúsculas, minúsculas e acentos, e ignora um `@` no começo do texto.
  O `not_member_of` passa a ser opcional: sem ele, ninguém fica de fora, inclusive quem busca. O
  limite e a ordem são os da F04.
- **Pessoa nas listas** (busca e Membros): ganha `username` e `title`.
- **Perfil:** qualquer Pessoa com Sessão lê o de qualquer outra. Id malformado ou que não é de
  Pessoa: `person_not_found`.
- **Fuso:** gravado pela própria Pessoa. O mesmo fuso de novo não muda nada.
- **Sessão:** a Pessoa devolvida ao entrar e ao verificar a Sessão ganha `username` e `time_zone`.

### Rotas (API do chat)

Todas autenticadas pelo guard da F01 e com o corpo de erro da rule de erros da API
(`.claude/rules/nest-api-errors.md`). Sem Sessão, respondem `unauthenticated` (401).

| Rota | Entrada | Sucesso | Erros |
| --- | --- | --- | --- |
| `POST /v1/conversations`, `planejada` com o `kind` novo | `kind: "direct"` e `person_id`, sem `client_id`, `name` nem `topic`; os Canais continuam com a entrada da F04 | 201 com `conversation`, quando criada agora; 200 quando já existia | `person_not_found` (404), `validation_failed` (400) |
| `GET /v1/people/:id`, `planejada` | — | 200 com `person`: `id`, `name`, `username`, `title`, `email`, `phone`, `time_zone` | `person_not_found` (404) |
| `PUT /v1/people/me/time-zone`, `planejada` | `time_zone` | 204 | `validation_failed` (400) |
| `GET /v1/people`, muda | `q` (opcional), `not_member_of` (opcional) | 200 com `people` (`id`, `name`, `username`, `title`) | `conversation_not_found` (404), `validation_failed` (400) |
| `GET /v1/conversations/:id/members`, muda | — | 200 com `members` (`id`, `name`, `username`, `title`) | `conversation_not_found` (404) |

- O `PersonNotFoundError` do comando passa a ter código HTTP: `person_not_found` entra no catálogo
  de códigos e nos mapas de status e de `detail` do filter global.

### Módulos (API do chat)

- `people`: a entidade ganha as colunas; o service ganha o Perfil, a gravação do fuso, a derivação
  do `@usuário` e a busca por nome ou `username`; um controller novo, as rotas do Perfil e do fuso.
- `conversations`: o service ganha abrir a Conversa direta e gravar a participação da outra Pessoa
  do par; a resposta da Conversa ganha `counterpart`.
- `memberships`: o service ganha abrir a Conversa direta, que orquestra a gravação e a publicação, e
  a busca deixa o `not_member_of` opcional. A publicação do `member_added` fica disponível ao envio
  de Mensagem.
- `messages`: o envio vira transação e, na Conversa direta, grava a participação da outra Pessoa e
  publica o `member_added` antes do `message.created`.
- `sessions`: a Pessoa da resposta ganha `username` e `time_zone`.
- `accounts`: o comando ganha as opções e a operação novas ("Comando de contas").

### Comando de contas (API do chat)

| Operação | Recebe | Efeito |
| --- | --- | --- |
| `create`, muda | E-mail; nome; `--username`, `--title` e `--phone`, opcionais | Cria a conta como na F01, com o `@usuário` informado ou derivado do e-mail. `@usuário`, cargo ou telefone fora da regra, ou `@usuário` já usado, recusam a criação com uma mensagem que diz o motivo |
| `update-profile`, nova | E-mail; `--title` e `--phone`, opcionais, ao menos um | Troca o cargo e o telefone; o valor vazio (`--title ""`) apaga o campo. Conta inexistente ou valor fora da regra são recusados com mensagem |

O `@usuário` não muda pelo comando. As duas operações entram no `AGENTS.md` da API, seção
"Comandos", na tarefa que as implementa.

### Tempo real (API do chat e `packages/chat-events`)

- **Sem evento novo.** A `ConversationPayload` ganha o `kind` `direct` e o `counterpart`, e o
  `conversation.member_added` passa a sair também na abertura e na primeira Mensagem de uma Conversa
  direta ("Conversa direta").
- **Para quem**, pela regra da F04: quem entrou agora recebe `person_ids` só com ela; quem já era
  Membro, `person_ids` de quem entrou.
  - Abertura: as abas de quem abriu e, se a outra Pessoa já é Membro, as dela.
  - Primeira Mensagem: as abas da outra Pessoa e as do autor.
- **Ordem:** na primeira Mensagem, o `member_added` é gravado no stream de cada Pessoa antes do
  `message.created`, e a reconexão os reenvia na mesma ordem.
- "Digitando" e abertura da Conversa no WebSocket não mudam: valem só para Membros, e a outra Pessoa
  não recebe o "digitando" antes da primeira Mensagem.

### BFF (web)

- **Server Actions:** `openDirectConversation` (o id da Pessoa) e `saveTimeZone` (o fuso). Validam a
  entrada como a API e devolvem a união discriminada da F01 (`ok`, `unauthenticated`, `not_found`,
  `failure`); `openDirectConversation` devolve a Conversa no `ok`.
- **Rota de leitura nova:** `GET /api/people/:id`, o Perfil, chamado pelo cliente. A
  `GET /api/people` aceita a busca sem `not_member_of`.
- **401** em qualquer uma leva a `GET /api/session/expired`, como na F02.
- **Iniciais** do `counterpart`, do Perfil e das Pessoas nas listas, calculadas como as da F01.

### Cliente (web)

**Lista de Conversas e barra lateral**

- A lista no cliente da F04 passa a ter as Conversas diretas. A barra lateral a separa por tipo:
  "Canais" e, abaixo, "Mensagens diretas", com a SidebarRow da Conversa direta (avatar e nome do
  `counterpart`, e "você" ao lado na Conversa consigo mesma) e a SidebarAction "Nova conversa" no
  fim.
- A inserção pelo `conversation.member_added` usa a mesma função da F04, com a ordem da Conversa
  direta pelo `counterpart.name`. Nada que chega abre a Conversa nem muda o foco.
- `openDirectConversation` com `ok` insere a Conversa na lista, se ela ainda não estiver lá, e leva a
  `/conversas/<id>` pelo `router.push`. O `member_added` da própria abertura, que chega depois, é
  ignorado pelo id repetido.
- A Home e o cookie da última Conversa valem para a Conversa direta sem mudança. Sem última Conversa,
  a Home abre o primeiro Canal da lista e, sem Canal, a primeira Conversa direta.

**Fuso**

- O `TimeZoneSync` da F02 passa também a comparar o fuso do navegador com o `time_zone` da Pessoa
  da Sessão e, se forem diferentes, chama `saveTimeZone`, uma vez por carga da página. Uma recusa
  da API não é mostrada à pessoa e não é tentada de novo na mesma carga.

**Painel de perfil**

- Um provedor cliente no layout das telas logadas guarda a Pessoa do painel, sem mexer no endereço.
  O painel fica no shell, depois da Conversa (design system, "Layout e responsividade"), continua
  aberto ao trocar de Conversa e fecha pelo X ou pelo Esc, com o foco voltando ao que o abriu. Abrir
  outro Perfil troca o conteúdo.
- O Perfil vem de `GET /api/people/:id`, num `useSWR` por Pessoa, lido de novo a cada abertura.
- A hora local é calculada no navegador com `Intl.DateTimeFormat` no `time_zone` da Pessoa, numa
  função pura, e o painel a atualiza a cada virada de minuto. Sem `time_zone`, a linha não aparece;
  sem cargo ou telefone, também não.
- "Mensagem" chama `openDirectConversation`, com o estado "Abrindo" no botão; na falha, o erro fica
  no painel, abaixo do botão, que tenta de novo.
- 404 mostra "Painel de perfil / Pessoa não encontrada"; outra falha, "Erro ao carregar", com
  "Tentar de novo".

**Onde o Perfil abre**

- O nome e o avatar do autor no MessageItem viram um botão, com o nome da Pessoa no rótulo.
- A PersonRow de "Membros de #nome" vira um botão: fecha o diálogo e abre o painel.
- No cabeçalho da Conversa direta, o avatar e o nome do `counterpart` são um botão.
- O menu do avatar do Rail ganha o item "Perfil", antes de "Sair do Full Cycle".

**Busca de Pessoas**

- Um componente só, usado no diálogo "Nova conversa" e no passo "Adicionar pessoas" da F04: o
  campo e a lista seguem o padrão combobox (o foco fica no campo, as setas mudam a Pessoa destacada
  por `aria-activedescendant`, e Enter a escolhe), com a espera e o descarte de resposta antiga da
  F04. A PersonRow mostra "@usuário · cargo", sem o cargo quando ele não existe, e "(você)" ao lado
  da própria pessoa.
- **"Nova conversa"** (SidebarAction de "Mensagens diretas"): Dialog com a busca sem
  `not_member_of`. Escolher uma Pessoa chama `openDirectConversation`, com o estado "Abrindo"; o
  diálogo fecha ao abrir a Conversa e, na falha, fica aberto com o erro e permite tentar de novo.

**Conversa direta**

- **Cabeçalho:** o avatar e o nome do `counterpart`, sem Tópico e sem o botão de Membros.
- **Começo da conversa:** o ConversationIntro ganha a variante da Conversa direta, com o avatar e
  o nome do `counterpart` e "Este é o começo da sua conversa direta com <nome>.". Na Conversa
  consigo mesma: "Este é o seu espaço. Guarde lembretes e rascunhos aqui; só você vê.".
- **Caixa de mensagem:** "Mensagem para <primeiro nome>", ou "Mensagem para você".

**Telas**, que reproduzem os frames do Figma (arquivo `slack`, página Telas):

- "Diálogos / Nova conversa": Carregando (26:26897), Lista (26:27752), Ninguém encontrado
  (26:28551) e Abrindo (26:29410).
- "Painel de perfil": Carregando (26:41815), Pessoa não encontrada (26:42679), Outra pessoa
  (26:43588), Próprio perfil (26:44497) e Abrindo conversa direta (26:46312); o erro é "Painel de
  perfil / Erro ao carregar (difere do código)" (26:47242).
- "Conversa / Estrutura / Conversa direta" (21:4128) e "Conversa / Lista / Início da conversa
  direta" (21:5056).
- A presença, o status, o selo de administrador e "Editar perfil", que aparecem nesses frames, não
  são implementados (PRD, "O que não é objetivo"). O Figma os mantém para a F09.
- **Mudança no Figma, antes do código de cada tela**, pelo `docs/design-system.md` ("Do código para
  o Figma"), cada uma na tarefa da tela que a usa:
  - corrigir o texto de "Início da conversa direta", que mostra "Este é o começo do canal #geral";
  - criar o começo da Conversa consigo mesma;
  - criar a falha ao abrir a Conversa direta, no diálogo "Nova conversa" e no painel;
  - criar o Perfil sem cargo, telefone e hora local;
  - pôr o item "Perfil" no menu do avatar;
  - pôr "@usuário · cargo" nas PersonRows do passo "Adicionar pessoas".

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que aparece na tela), e não a forma interna dos services. A
forma de cada teste da API está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de ponta a ponta por HTTP com banco real:**

- abrir a Conversa direta cria a Conversa e a participação só de quem abriu (201); abrir de novo
  devolve a mesma (200); a outra ponta abrindo antes da primeira Mensagem cai na mesma Conversa e
  vira Membro; as duas pontas ao mesmo tempo dão numa Conversa só; a Conversa consigo mesma tem um
  Membro;
- `person_id` que não é de Pessoa: 404; entrada com `name` ou `client_id`: 400;
- a outra Pessoa, antes da primeira Mensagem, e qualquer Pessoa de fora recebem 404 na Conversa, no
  histórico, no envio e nos Membros, e não a veem na lista;
- a primeira Mensagem torna a outra Pessoa Membro, e a Conversa entra na lista dela com o
  `counterpart`; o reenvio da Mensagem não grava nada a mais;
- adicionar Membros a uma Conversa direta: 409;
- a lista de Conversas com os Canais primeiro e as Conversas diretas pelo nome do `counterpart`;
- o Perfil completo e sem os campos opcionais; id malformado e inexistente: 404;
- o fuso válido é gravado e aparece no Perfil e na Sessão; o inválido: 400;
- a busca acha pelo `@usuário`, com e sem o `@`, e pelo nome sem acento; sem `not_member_of`, inclui
  quem busca; com ele, continua como na F04;
- sem Sessão, as rotas novas respondem 401.

**API do chat, testes de ponta a ponta com o servidor real e `socket.io-client`**, como os da F03 e
da F04:

- a abertura publica `conversation.member_added` às outras abas de quem abriu, e não à outra
  Pessoa antes da primeira Mensagem;
- a primeira Mensagem entrega à outra Pessoa o `member_added` e depois o `message.created`, nessa
  ordem; a segunda Mensagem só o `message.created`;
- os dois eventos voltam na reconexão com cursor, na mesma ordem;
- a outra Pessoa não recebe o "digitando" antes da primeira Mensagem.

**Comando, teste de integração:** `create` com `--username`, `--title` e `--phone`; sem
`--username`, derivado do e-mail, com sufixo quando repete; `@usuário` inválido ou já usado,
recusado; `update-profile` troca e apaga o cargo e o telefone, e recusa conta inexistente.

**Banco, teste de ponta a ponta da migração**, no arquivo dos testes de banco: a derivação do
`@usuário` das contas que já existem, o sufixo pela ordem de criação e o `pessoa`.

**Unidade (API):** a derivação do `@usuário` a partir do e-mail.

**Web, Vitest para as funções puras:** a ordem das Conversas diretas na lista, a inserção pelo
`member_added` com o `counterpart` e a hora local no fuso de outra Pessoa.

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F05 junto dos testes. Duas Pessoas em dois contextos do navegador:

- uma busca a outra pelo `@usuário` em "Nova conversa", abre a Conversa direta e envia uma
  Mensagem; a Conversa aparece na barra lateral da outra sem recarregar, e a resposta chega em tempo
  real;
- a Conversa aberta sem Mensagem não aparece para a outra Pessoa, nem pelo endereço;
- o Perfil aberto pelo autor da Mensagem, pela lista de Membros, pelo cabeçalho da Conversa direta e
  pelo menu do avatar, e "Mensagem" no Perfil abrindo a Conversa direta;
- a Conversa consigo mesma, com "você" na barra lateral;
- a falha ao abrir a Conversa e ao carregar o Perfil, pelo `page.route`;
- tudo pelo teclado, inclusive as setas na busca, e a checagem de acessibilidade com
  `@axe-core/playwright` no diálogo "Nova conversa", no painel de perfil e na Conversa direta, sem
  violações.

**Medição:** nenhuma nova. A Conversa direta chega pelo `conversation.member_added` da F04, cujo p95
está na medição da F04-T03.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois
temas, comparada com o `get_screenshot` dos frames citados (`docs/design-system.md`, "Validação
visual"), registrada na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse com o diálogo "Nova conversa", o painel de perfil e a Conversa direta.

**Exemplos anteriores:** os testes da F02 a F04, nas mesmas pastas e com as mesmas bases, em
especial os da criação de Canal, da busca de Pessoas e do tempo real das Conversas.

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- Evento de mudança de Perfil: o cargo e o telefone trocados pelo comando aparecem na próxima
  abertura do painel.
- Pessoa apagada: não há operação que apague Pessoa; a referência apaga a Conversa direta junto.
- O snapshot OpenAPI das rotas novas, que segue planejado no LLD.

## Observações

- O glossário mudou: "Membro" vale para qualquer Conversa, "Conversa direta" inclui a da Pessoa
  consigo mesma, e entram "@usuário" e "Perfil".
- A ADR 0025 registra por que a outra Pessoa só vira Membro na primeira Mensagem.
- O registro no LLD está nas seções "Concorrência e idempotência", "Dados", "Interfaces",
  "Cliente", "Valores e configuração" e no índice de ADRs.
- Os nós do Figma citados vieram do levantamento feito para esta spec e podem mudar de id se os
  frames forem recriados. Nesse caso, valem os nomes.
