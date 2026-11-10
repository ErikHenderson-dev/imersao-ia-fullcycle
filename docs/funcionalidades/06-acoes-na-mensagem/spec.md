# Spec · F06 · Ações na mensagem

2026-11-10 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F06 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

## Problema

Uma Mensagem enviada não muda mais, não chama a atenção de ninguém e não diz a que Mensagem
responde. A contagem de menções (F07), a notificação de menção (F08) e o pedido a um agente por
menção (F11 e F12) dependem de a Menção existir (PRD, seção 1, "Resumo executivo").

## Solução

A Mensagem ganha três coisas no Banco do chat: as Menções, numa tabela própria, resolvidas pela API
a partir do `@usuário` escrito no texto; a Citação, numa coluna que aponta para outra Mensagem da
mesma Conversa; e as marcas de edição e de exclusão. Duas rotas novas editam e apagam, o envio
aceita a Citação, e a busca de Pessoas passa a filtrar pelos Membros de uma Conversa, para a lista
de menções. Dois eventos novos, `message.updated` e `message.deleted`, levam as mudanças a todos os
Membros pelo mesmo caminho do `message.created`, com a reconexão da F03. Na web, a MessageItem
ganha a barra de ações e o menu, a caixa de mensagem ganha a lista de menções e a Citação, e a
edição acontece no lugar da Mensagem. O fluxo completo está no PRD, seção 2, "Fluxo".

## Histórias de usuário

As histórias 1 a 7 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá.

## Decisões de implementação

### Mensagens (API do chat)

A tabela `messages` muda, `planejada`:

| Coluna ou regra | Mudança |
| --- | --- |
| `quoted_message_id` | uuid, opcional, referência a `messages`. Apagar fisicamente a original não acontece (a exclusão é lógica), então a referência não tem ação de cascata |
| `edited_at` | timestamptz, opcional: a hora da última edição que mudou o texto |
| `deleted_at` | timestamptz, opcional: a hora da exclusão |
| `body` | Passa a aceitar nulo. O `CHECK` vira: `body` nulo se e só se `deleted_at` preenchido; preenchido, de 1 a 4000 caracteres, como hoje |

A tabela `message_mentions` é nova, `planejada`:

| Coluna ou regra | Regra |
| --- | --- |
| `message_id` | uuid, referência a `messages`, com cascata |
| `person_id` | uuid, referência a `people`, com cascata |
| Unicidade | (`message_id`, `person_id`) |
| Índice | `person_id`, para a F07 e a F08 lerem as Menções de uma Pessoa |

**Menções, ao gravar** (envio e edição):

- O texto guarda o que a pessoa escreveu, com `@usuario` em texto puro. O `@usuário` não muda
  (spec da F05, "Pessoas"), então serve de referência estável.
- A API extrai do texto os `@usuario` que começam o texto ou vêm depois de um caractere que não é
  letra, número, `.`, `_` ou `-`, com o formato do `username` da F05, comparados em minúsculas.
- Cada um que for de um Membro da Conversa naquele momento vira uma linha em `message_mentions`. O
  que não é de Membro, ou não existe, fica só no texto, sem Menção (PRD, "Regras desta
  funcionalidade").
- A Menção fica congelada: quem deixa de ser Membro depois continua mencionado na Mensagem antiga, e
  só uma edição a recalcula.
- O próprio autor pode se mencionar; a Menção vale como as outras.
- Uma função pura da API faz a extração; a conferência dos Membros é uma consulta só, pelos
  `username` extraídos.

**Enviar com Citação:**

- O envio aceita `quoted_message_id`, opcional. A original precisa ser da mesma Conversa e não
  estar apagada; senão, `quoted_message_not_found` (404).
- O reenvio idempotente pelo `client_id` (LLD, "Concorrência e idempotência") devolve a Mensagem já
  gravada, sem olhar a Citação nem as Menções da nova tentativa, como já faz com o texto.
- As Menções são gravadas na mesma transação do envio, que a F05 já tornou transação.

**Editar:**

- Só o autor. Mensagem de outra Pessoa: `message_not_owned` (403). Mensagem que não existe, que já
  foi apagada, de outra Conversa, ou de uma Conversa de que a Pessoa não é Membro:
  `message_not_found` (404), sem revelar qual dos casos.
- O texto passa pela mesma validação do envio (sem espaços nas pontas, de 1 a 4000 caracteres, sem
  NUL).
- Texto igual ao gravado: responde 200 com a Mensagem, sem mudar `edited_at` nem publicar evento.
- Texto diferente, numa transação: grava o texto e `edited_at`, recalcula as Menções e grava a
  diferença (insere as novas, apaga as que saíram). Depois do commit, publica `message.updated`.
- A Citação não muda na edição.
- **Atomicidade com a exclusão:** a transação da edição começa lendo a Mensagem com trava de linha
  (`FOR UPDATE`), e a da exclusão também. Assim, uma exclusão e uma edição da mesma Mensagem
  acontecem uma depois da outra: a que chega depois de uma exclusão encontra `deleted_at`
  preenchido e responde `message_not_found`, sem violar o `CHECK` do `body`.
- Duas edições ao mesmo tempo: a trava as põe em fila, e vale a última gravação.

**Apagar:**

- As mesmas regras de acesso e os mesmos erros da edição. Apagar o que já foi apagado responde
  `message_not_found` (404); a web trata esse 404 do "Apagar" como Mensagem já apagada.
- Numa transação, com a mesma trava de linha da edição: zera o `body` e grava `deleted_at`. Depois
  do commit, publica `message.deleted`.
- As linhas de `message_mentions` da Mensagem apagada ficam: são o que diz quem foi mencionado,
  e a F07 e a F08 precisam disso para corrigir contadores e notificações. Quem lê Menções ignora as
  das Mensagens apagadas (`deleted_at` preenchido); nesta funcionalidade, nenhuma leitura as mostra,
  porque o histórico já não traz a Mensagem.
- A linha fica só para as Citações mostrarem "Em resposta a uma mensagem apagada" (PRD, "Regras
  desta funcionalidade"). O HLD e o LLD dizem hoje que "fica a marca 'mensagem apagada'" e são
  atualizados para isso ("Observações").
- O que a exclusão e a edição fazem com os contadores (F07) e com as notificações (F08) fica para
  essas funcionalidades, que leem `message_mentions`. O item do LLD "mensagem (exclusão com menções,
  notificações e contadores; edição que acrescenta menção)" fica resolvido do lado da F06 e
  pendente do lado da F07 e da F08.

**Histórico:**

- Ignora as Mensagens apagadas (`deleted_at` nulo). O cursor continua o id (LLD, "Paginação"), e
  uma página pode vir com menos Mensagens que o limite sem que isso signifique o fim: o fim continua
  sendo o `has_more`.

**A Mensagem no REST e nos eventos** ganha:

| Campo | Conteúdo |
| --- | --- |
| `edited_at` | A hora da última edição, ou nulo |
| `mentions` | Lista de `id` e `username` das Pessoas mencionadas, ou vazia |
| `quote` | Nulo sem Citação; com ela, `id` da original e `deleted`. Não apagada, também `author` (`id` e `name`) e o `body` atual da original; apagada, só os dois primeiros |

- Uma função só monta a Mensagem para o histórico, para o envio, para a edição e para os eventos.
  O histórico carrega as Menções e as Citações de uma página em duas consultas, e não uma por
  Mensagem. Isso adianta o item do LLD "Função única que monta a mensagem para cada destinatário",
  sem a parte de dados de negócio, que fica para a F13.

### Busca de Pessoas para a lista de menções (API do chat)

- A `GET /v1/people` aceita `member_of`, o id de uma Conversa: só os Membros dela, com o mesmo
  texto, a mesma ordem e o mesmo limite de 20 da F04 e da F05. A Pessoa que busca precisa ser Membro
  da Conversa; senão, `conversation_not_found`.
- `member_of` e `not_member_of` juntos: `validation_failed`.
- A lista de Membros da F04 (`GET /v1/conversations/:id/members`) não serve aqui, porque devolve
  todos os Membros de uma vez, e num Canal público isso é o workspace inteiro.

### Rotas (API do chat)

Todas autenticadas pelo guard da F01 e com o corpo de erro da rule de erros da API
(`.claude/rules/nest-api-errors.md`). Sem Sessão, respondem `unauthenticated` (401).

| Rota | Entrada | Sucesso | Erros |
| --- | --- | --- | --- |
| `POST /v1/conversations/:conversationId/messages`, muda | `client_id`, `body` e `quoted_message_id` (opcional) | Como hoje, com a Mensagem nova | Os de hoje e `quoted_message_not_found` (404) |
| `PATCH /v1/conversations/:conversationId/messages/:id`, `planejada` | `body` | 200 com `message` | `message_not_found` (404), `message_not_owned` (403), `validation_failed` (400) |
| `DELETE /v1/conversations/:conversationId/messages/:id`, `planejada` | — | 204 | `message_not_found` (404), `message_not_owned` (403) |
| `GET /v1/conversations/:conversationId/messages`, muda | Como hoje | Como hoje, sem as apagadas e com os campos novos | Os de hoje |
| `GET /v1/people`, muda | `q`, `not_member_of` ou `member_of` (opcionais) | Como hoje | Os de hoje |

- `message_not_found`, `message_not_owned` e `quoted_message_not_found` entram no catálogo de
  códigos e nos mapas de status e de `detail` do filter global.

### Tempo real (API do chat e `packages/chat-events`)

- **Dois eventos novos**, guardados nos eventos por Pessoa e reenviados na reconexão como o
  `message.created` (spec da F03, "Eventos por Pessoa e reconexão"):
  - `message.updated`: a Mensagem inteira, montada pela mesma função do REST.
  - `message.deleted`: `conversation_id` e `message_id`.
- **Para quem:** todos os Membros da Conversa no momento da publicação, em todas as abas, inclusive
  as do autor, como o `message.created`.
- **Contrato:** os dois entram em `StoredEventPayloads` e em `ServerToClientEvents`, e os nomes,
  na lista de eventos reenviados na reconexão. A emissão do publisher e o reenvio do gateway deixam
  de supor que todo evento guardado de Mensagem é `message.created`.
- **Falha na publicação:** como a do `message.created`, só registrada em log. Quem estava conectado
  vê a mudança ao abrir a Conversa de novo (LLD, "Transações").
- **Ordem:** a dos identificadores do stream de cada Pessoa, que é a ordem das publicações, e não
  necessariamente a das gravações: a publicação acontece depois do commit, e uma edição pode
  publicar depois de uma exclusão que gravou depois dela. Quem garante o estado final é o
  cliente, que descarta o evento obsoleto ("Cliente", "Eventos no cliente"). A reconexão reenvia
  na ordem do stream, e a mesma regra vale.
- O `message.updated` de uma edição que acrescentou uma Menção já leva a Pessoa em `mentions`: o
  destaque aparece para ela sem evento próprio.

### BFF (web)

- **Server Actions:** `editMessage` (Conversa, Mensagem e texto) e `deleteMessage` (Conversa e
  Mensagem), com a união discriminada da F01 (`ok`, `unauthenticated`, `not_found`, `forbidden`,
  `failure`); `editMessage` devolve a Mensagem no `ok`. `sendMessage` passa a levar
  `quotedMessageId`, e o `not_found` dele passa a cobrir também a Citação.
- **Rota de leitura:** a `GET /api/people` aceita `member_of`.
- **O tipo `Message` da web** ganha `editedAt`, `mentions` e `quote`.
- **401** em qualquer uma leva a `GET /api/session/expired`, como na F02.

### Cliente (web)

**Texto da Mensagem**

- O corpo da Mensagem passa a ser dividido em três tipos de pedaço: texto, link (como hoje) e
  Menção. Um `@usuario` vira Menção só se o `username` estiver em `mentions` da Mensagem, numa
  função pura. Fora disso, é texto.
- A Menção é a MentionChip, que mostra `@usuario` (o texto escrito, e não o nome) e é um botão que
  abre o painel de perfil da Pessoa (spec da F05, "Painel de perfil"). É amarela quando é a própria
  pessoa, e azul nos outros casos.
- A Mensagem que menciona a pessoa logada ganha o tom `highlighted` da MessageItem.
- "(editada)" aparece depois do texto quando `editedAt` existe, com a hora da edição no `title`.

**Barra de ações e menu**

- A MessageItem ganha a MessageActions, visível no hover e quando o foco está dentro da Mensagem
  (`:focus-within`). Cada botão é um IconButton com Tooltip (atraso do design system). "Editar"
  aparece só quando o autor é a pessoa logada.
- "Mais ações" abre a MessageMenu, um DropdownMenu com os itens do PRD. "Apagar" usa o tom
  `danger`.
- Mensagens `sending` e `failed` não renderizam a barra nem o menu.
- O Tooltip e o ConfirmDialog (sobre o AlertDialog do `radix-ui`) entram em `components/ui` nesta
  funcionalidade; o `sonner` é instalado e o Toaster entra no layout das telas logadas (design
  system, "Bibliotecas" e "Componentes").

**Copiar texto**

- `navigator.clipboard.writeText` com o `body` como está gravado. No sucesso, toast "Texto
  copiado"; na recusa, toast de erro "Não foi possível copiar o texto".

**Lista de menções**

- Na caixa de mensagem e na edição, a textarea segue o padrão combobox enquanto a lista está aberta:
  o foco fica na textarea, as setas mudam a Pessoa destacada por `aria-activedescendant`, Enter ou
  Tab escolhe e Esc fecha.
- Abre quando o cursor está logo depois de um `@` que começa o texto ou vem depois de um espaço ou
  de uma quebra de linha, e o texto entre o `@` e o cursor não tem espaço. O botão `@` da caixa
  insere um `@` na posição do cursor (com um espaço antes, se precisar) e abre a lista.
- A busca é a `GET /api/people` com `member_of` e o texto depois do `@`, com a espera e o descarte
  de resposta antiga da F04 e da F05. A linha é a MentionOption: avatar, nome e "@usuário · cargo".
- Escolher troca o `@texto` por `@usuario ` e põe o cursor depois do espaço. Sem resultado, a lista
  fecha.
- Enter com a lista aberta escolhe a Pessoa e não envia nem salva a Mensagem.
- A detecção do `@` e a troca do texto são funções puras.

**Citação**

- "Responder" guarda a Mensagem citada num estado da caixa de mensagem daquela Conversa e leva o
  foco à textarea. A caixa mostra "Respondendo a <nome>", o começo do texto e o botão "Cancelar
  resposta". Esc com a lista de menções fechada, ou o botão, desistem da Citação.
- Trocar de Conversa limpa a Citação. Um `message.deleted` da Mensagem citada também, com o aviso
  "A mensagem que você estava respondendo foi apagada".
- O envio leva `quotedMessageId`. A Mensagem pendente mostra a Citação montada com os dados que a
  tela já tem. O `not_found` do envio com Citação vira a falha no envio da F02, com a mensagem de que
  a Mensagem citada foi apagada.
- A ReplyQuote mostra o nome do autor e o começo do texto da original, numa linha, ou "Em resposta
  a uma mensagem apagada", sem ação, quando `quote.deleted`.

**Ir até a Mensagem citada**

- Clicar na ReplyQuote procura a original na lista carregada. Se ela estiver lá, rola até ela
  (`scrollIntoView` no centro) e aplica o destaque de "Destaque por link" por 2 s.
- Se ela não estiver lá, a Conversa mostra "Indo até a mensagem" e carrega páginas anteriores, com
  o limite máximo de 100, até a página que contém a original ou que já começa antes dela (os ids são
  UUID v7, em ordem de criação), e então rola. Se a original não aparecer nessa busca (apagada no
  meio), o aviso "A mensagem não está mais disponível" substitui o estado.
- Enquanto vai até a Mensagem, a rolagem automática da Mensagem nova (LLD, "Distância do fim da
  lista") não puxa a lista para o fim.

**Edição**

- "Editar" troca o corpo da MessageItem pela MessageEditor: uma textarea com o texto atual, o foco
  no fim, a lista de menções, o mesmo contador de limite da F02, e a dica "Enter para salvar · Esc
  para cancelar".
- Uma Mensagem por vez fica em edição na Conversa: editar outra fecha a primeira sem salvar.
- Enter chama `editMessage`, no estado "Salvando". Texto vazio ou acima do limite não chama a
  action. No `ok`, a Mensagem é trocada no cache e a edição fecha; o `message.updated` que chega
  depois, igual, não muda nada. Na falha, "Edição com erro", com o texto mantido e "Tentar de novo".
  O `not_found` fecha a edição e tira a Mensagem da lista, com o aviso de que ela foi apagada.
- Ao fechar, o foco volta para a Mensagem.

**Apagar**

- "Apagar" abre o ConfirmDialog "Apagar mensagem?", com o texto da Mensagem, o foco em "Cancelar",
  sem fechar pelo clique fora.
- "Apagar" chama `deleteMessage`, no estado "Apagando". O `ok` e o `not_found` tiram a Mensagem do
  cache e fecham o diálogo; a falha mantém o diálogo com o erro ("Erro ao apagar") e "Tentar de
  novo". Depois, o foco vai para a Mensagem seguinte, ou para a caixa de mensagem se não houver.

**Eventos no cliente**

- O provedor de tempo real passa a tratar `message.updated` e `message.deleted`, com o mesmo
  buffer e a mesma ordem da sincronização, e o hook de Mensagens da Conversa os aplica no cache do
  SWR, em funções puras:
  - `message.updated` troca a Mensagem pelo id, se ela estiver carregada e o `edited_at` do evento
    for posterior ao da Mensagem no cache, e atualiza do mesmo jeito a `quote` das Mensagens
    carregadas que a citam, exceto a `quote` já marcada `deleted`;
  - `message.deleted` tira a Mensagem pelo id e marca `deleted` na `quote` das que a citam.
- Por isso, um `message.updated` que chega depois do `message.deleted` da mesma Mensagem não a traz
  de volta: ela não está mais no cache, e a `quote` apagada não volta a mostrar texto. Um
  `message.updated` atrasado, de uma edição anterior à que a tela já mostra, também é descartado.
- O agrupamento por autor e por dia (F02) é recalculado a partir da lista, então a Mensagem
  seguinte à apagada ganha nome e avatar sem regra nova.
- A edição aberta de uma Mensagem que chega como `message.deleted` fecha, com o aviso do PRD.
  Uma que chega como `message.updated` de outra aba continua aberta com o texto que a pessoa está
  digitando.
- Nenhum dos dois muda a posição da rolagem.

**Telas**, que reproduzem os frames do Figma (arquivo `slack`, página Telas):

- "Conversa / Mensagem": Hover com barra de ações (22:10143), Menciona você (22:8334), Destaque
  por link (22:9191), Com citação (22:13744), Citação apagada (22:14607), Editada (22:12887),
  Edição (22:16333), Edição salvando (22:18117) e Edição com erro (22:17221).
- "Conversa / Composer": Lista de menções (23:14538) e Citando (23:15389).
- "Conversa / Lista / Indo até a mensagem" (21:10072).
- "Conversa / Sobreposições": Menu da própria mensagem (23:18093), Menu de mensagem de terceiros
  (23:19029), Confirmar apagar (23:19941), Apagando (23:20832) e Erro ao apagar (23:21715).
- Não são implementados, embora apareçam nesses frames: `@canal`, `@aqui` e o agente na lista de
  menções, e "Citação restrita" (22:15476) (PRD, "O que não é objetivo").
- **Mudança no Figma, antes do código de cada tela**, pelo `docs/design-system.md` ("Do código para
  o Figma"), cada uma na tarefa da tela que a usa:
  - tirar `@canal`, `@aqui` e o agente da lista de menções;
  - trocar "@Admin" por "@admin" em "Menciona você", porque a Menção mostra o `@usuário`;
  - criar a falha ao copiar o texto (toast de erro);
  - criar a ida até uma Mensagem citada que não está mais disponível;
  - criar a edição acima do limite de caracteres.

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que aparece na tela), e não a forma interna dos services. A
forma de cada teste da API está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de ponta a ponta por HTTP com banco real:**

- o envio com `@usuario` de Membros grava as Menções e as devolve em `mentions`; `@usuario` de quem
  não é Membro de um Canal privado, ou que não existe, não vira Menção; o `@usuario` em maiúsculas
  vira Menção; a própria pessoa pode se mencionar;
- o envio com Citação devolve a `quote`; Citação de outra Conversa, inexistente ou apagada: 404; o
  reenvio idempotente não muda a Citação nem as Menções;
- editar troca o texto, grava `edited_at` e recalcula as Menções (entra uma, sai outra); editar com
  o mesmo texto não muda `edited_at`; texto vazio ou acima de 4000: 400; Mensagem de outra Pessoa:
  403; inexistente, apagada, de outra Conversa ou de quem não é Membro: 404;
- apagar zera o texto e grava `deleted_at`, e as Menções dela ficam; apagar de novo: 404; Mensagem de outra
  Pessoa: 403;
- o histórico não traz a apagada e mostra a `quote` com `deleted` nas Mensagens que a citavam; a
  `quote` mostra o texto editado da original;
- a busca com `member_of` traz só Membros, com o texto e o limite de antes; quem não é Membro: 404;
  `member_of` com `not_member_of`: 400;
- sem Sessão, as rotas novas respondem 401.

**API do chat, testes de ponta a ponta com o servidor real e `socket.io-client`**, como os da F03 a
F05:

- editar entrega `message.updated` a todos os Membros, em todas as abas, e não a quem não é Membro;
  editar com o mesmo texto não entrega nada;
- apagar entrega `message.deleted` do mesmo jeito;
- os dois voltam na reconexão com cursor, na ordem do stream;
- uma edição e uma exclusão da mesma Mensagem ao mesmo tempo terminam com a Mensagem apagada e a
  edição respondendo 404 ou gravando antes, sem erro do banco.

**Banco, teste de ponta a ponta da migração**, no arquivo dos testes de banco: as Mensagens que já
existem continuam válidas no `CHECK` novo.

**Unidade (API):** a extração dos `@usuario` do texto (começo do texto, depois de pontuação, dentro
de um e-mail, que não conta, maiúsculas e repetidos).

**Web, Vitest para as funções puras:** a divisão do corpo em texto, link e Menção; a detecção do `@`
e a troca pelo `@usuario` escolhido; a aplicação de `message.updated` e `message.deleted` no cache,
inclusive nas `quote`, com o descarte do `message.updated` obsoleto e do que chega depois do
`message.deleted`; e a decisão de parar de carregar páginas ao ir até a Mensagem citada.

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F06 junto dos testes. Duas Pessoas em dois contextos do navegador:

- uma menciona a outra pela lista de menções, só pelo teclado; a outra vê a Mensagem com o fundo
  de "Menciona você" e a Menção amarela, e clicar na Menção abre o Perfil;
- responder citando e clicar na Citação leva à original, inclusive quando ela não está carregada;
- copiar o texto e conferir a área de transferência (permissão `clipboard-read` no contexto);
- editar a própria Mensagem e ver o texto novo e "(editada)" na outra Pessoa sem recarregar; a
  Mensagem da outra Pessoa não tem "Editar";
- apagar, com a confirmação, e ver a Mensagem sumir na outra Pessoa e a Citação a ela virar "Em
  resposta a uma mensagem apagada";
- a falha ao editar e ao apagar, pelo `page.route`;
- tudo pelo teclado, e a checagem de acessibilidade com `@axe-core/playwright` com a barra de ações,
  o menu, a lista de menções, a edição e o diálogo de apagar abertos, sem violações.

**Medição:** o p95 de 1 s da edição e da exclusão (PRD, história 7) segue o caminho medido para o
`message.created` na F03, sem medição nova.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois
temas, comparada com o `get_screenshot` dos frames citados (`docs/design-system.md`, "Validação
visual"), registrada na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse com a barra de ações, a lista de menções, a edição e o diálogo de apagar.

**Exemplos anteriores:** os testes da F02 a F05, nas mesmas pastas e com as mesmas bases, em
especial os do envio de Mensagem, da busca de Pessoas e da reconexão.

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- Contadores e notificações das Menções, inclusive o que a edição e a exclusão fazem com eles: F07
  e F08, a partir de `message_mentions`.
- A versão bloqueada de dados de negócio na Mensagem e na Citação: F13.
- Rota para ir direto a uma Mensagem antiga (janela em volta de um id): a ida até a Citação carrega
  páginas, o que basta no MVP.
- O snapshot OpenAPI das rotas novas, que segue planejado no LLD.

## Observações

- O glossário ganhou "Menção" e "Citação". "Resposta" fica livre para a thread da F20.
- O HLD (seção 7, "Regras que pesam no desenho") e o LLD ("Dados") dizem que a Mensagem apagada
  deixa a marca "mensagem apagada". Com esta spec, ela sai da Conversa, e a marca só aparece na
  Citação. Os dois foram atualizados, e o registro desta spec no LLD está nas seções "Segurança"
  (a função única que monta a Mensagem), "Concorrência e idempotência", "Dados" (Mensagens e
  Menções), "Interfaces" (rotas e eventos), "Cliente" e no item de "Questões em aberto" sobre as
  regras da mensagem.
- Os nós do Figma citados vieram do levantamento feito para esta spec e podem mudar de id se os
  frames forem recriados. Nesse caso, valem os nomes.
