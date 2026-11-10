# Spec · F08 · Notificações e Atividade

2026-11-10 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F08 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

## Problema

A Pessoa só fica sabendo de uma Menção ou de uma Mensagem numa Conversa direta se olhar a barra
lateral, e não há um lugar que reúna o que foi para ela (PRD, seção 1, "Resumo executivo").

## Solução

As Notificações não são gravadas: saem de uma consulta sobre as Menções, as Conversas diretas e a
Última leitura da F07, e a única coisa nova no banco é a marca "Atividade lida até" na Pessoa, que
"Marcar tudo como lido" avança ([ADR 0027](../../adr/0027-notificacoes-calculadas.md)). A
exclusão, a edição que muda Menção e a leitura da Conversa corrigem as Notificações sozinhas. A API
ganha a lista e os números de Atividade e um evento novo, `activity.unread`, com os números. O
Alerta e a notificação do navegador nascem no cliente, a partir do `message.created` que a aba já
recebe, e as abas de um navegador combinam o foco entre si. Na web entram a tela Atividade, o ícone
Atividade no rail, a opção do navegador no menu da conta e a abertura da Conversa na Mensagem. O
fluxo completo está no PRD, seção 2, "Fluxo".

## Histórias de usuário

As histórias 1 a 5 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá.

## Decisões de implementação

### Notificações e contagem (API do chat)

A tabela `people` muda, `planejada`:

| Coluna | Mudança |
| --- | --- |
| `activity_read_message_id` | uuid, opcional, referência a `messages`, sem cascata (a exclusão de Mensagem é lógica). Nulo: nada marcado como lido em Atividade |

**Migração:** só acrescenta a coluna, nula. Quem já usa o chat não ganha uma avalanche de
Notificações no dia da entrega porque a migração da F07 já pôs a Última leitura de cada Conversa
na última Mensagem.

**As Notificações de uma Pessoa**, numa função só da API, usada pela lista, pelos números e pelo
evento:

- **Menção:** cada linha de `message_mentions` da Pessoa cuja Mensagem é de um Canal (público ou
  privado) de que ela é Membro hoje, de outro autor e com `deleted_at` nulo. A Menção a si mesma
  fica fora pelo autor.
- **Mensagem direta:** cada Mensagem de outro autor, com `deleted_at` nulo, numa Conversa direta de
  que a Pessoa é Membro. A Conversa direta consigo mesma fica fora pelo autor, e a Menção dentro
  de uma Conversa direta não gera uma segunda Notificação, porque a fonte de Menções só olha
  Canais.
- O histórico anterior à entrada não aparece: a Menção só nasce para quem já é Membro ao gravar
  (spec da F06, "Menções, ao gravar"), e a outra Pessoa de uma Conversa direta entra nela na
  primeira Mensagem (ADR 0025).
- Quem deixa de ser Membro de um Canal privado perde as Notificações dele, pela junção com a
  participação atual.
- **Lida:** o id da Mensagem é menor ou igual ao maior entre a Última leitura da Conversa e
  `activity_read_message_id` (ids UUID v7, comparados como na F07).
- **Números:** `mention_count`, as Menções não lidas; `direct_count`, as Mensagens diretas não
  lidas; `total_count`, a soma. Cada um para em 100, como o "Teto da contagem de não lidas" do LLD
  ("Valores de regra"), e a web mostra `99+`.
- As Menções saem do índice de `message_mentions` por Pessoa e Mensagem (F07), e as Mensagens
  diretas, das Conversas diretas da Pessoa cruzadas com o índice `(conversation_id, id)` de
  `messages`.

**Avançar a marca de Atividade:** como a Última leitura, só avança
(`activity_read_message_id IS NULL OR activity_read_message_id < :novo`). A Mensagem pedida precisa
ser de uma Conversa de que a Pessoa é Membro, apagada ou não, porque é só uma posição. Não mexe na
Última leitura de nenhuma Conversa (PRD, "Regras desta funcionalidade", "Notificação lida").

**Versão por Pessoa:** a Mensagem de cada item sai pela mesma função que monta a Mensagem para o
histórico e os eventos (spec da F06, "Mensagens"), que passa a montar também a versão de cada
destinatário de Atividade. É ela que, quando os agentes existirem, entrega a versão bloqueada de uma
Mensagem com dados de negócio a quem não tem permissão (ADR 0020), e o item do LLD que deixava isso
"a definir" fica resolvido.

### Rotas (API do chat)

Todas autenticadas pelo guard da F01 e com o corpo de erro da rule de erros da API
(`.claude/rules/nest-api-errors.md`). Sem Sessão, respondem `unauthenticated` (401).

| Rota | Entrada | Sucesso | Erros |
| --- | --- | --- | --- |
| `GET /v1/activity`, `planejada` | `kind` (`all`, `mentions` ou `direct`; padrão `all`), `before` e `limit` (LLD, "Paginação") | 200 com `items` e `has_more`. Cada item: `kind` (`mention` ou `direct`), `message` (a Mensagem como no REST) e `conversation` (`id`, `kind`, `name` e `counterpart`, como na lista de Conversas) | `validation_failed` (400) |
| `GET /v1/activity/unread`, `planejada` | — | 200 com `activity_read_message_id`, `total_count`, `mention_count` e `direct_count` | — |
| `PUT /v1/activity/read`, `planejada` | `message_id` | 200 com o mesmo corpo de `GET /v1/activity/unread` | `message_not_found` (404), `validation_failed` (400) |

- `GET /v1/activity`: keyset pelo id da Mensagem, com os itens em ordem cronológica, como manda o
  LLD; a web inverte para mostrar a mais nova em cima. O item não traz "lida": o cliente a calcula
  com a Última leitura da lista de Conversas e a marca de Atividade, que já tem e que o tempo real
  mantém em dia.
- `PUT /v1/activity/read`: Mensagem que não existe ou é de uma Conversa de que a Pessoa não é
  Membro responde `message_not_found`. Uma posição igual ou anterior à gravada responde 200 com os
  números atuais, sem gravar nem publicar.

### Tempo real (API do chat e `packages/chat-events`)

- **Evento novo, `activity.unread`:** `activity_read_message_id`, `total_count`, `mention_count` e
  `direct_count` de quem recebe, guardado nos eventos por Pessoa e reenviado na reconexão, como o
  `conversation.unread` (spec da F07, "Tempo real"). Entra em `StoredEventPayloads`, em
  `ServerToClientEvents` e na lista de eventos reenviados.
- **Para quem**, depois do commit e dos eventos de Mensagem e de `conversation.unread` da mesma
  mudança:

| Mudança | Quem recebe |
| --- | --- |
| Mensagem enviada | O autor (a Última leitura dele avançou); num Canal, as Pessoas mencionadas; numa Conversa direta, a outra Pessoa |
| Edição que muda as Menções | As Pessoas que entraram ou saíram de `message_mentions` |
| Mensagem apagada | Das Pessoas mencionadas num Canal, ou da outra Pessoa da Conversa direta, as que não tinham lido a Mensagem |
| Leitura de Conversa que avançou | Só a própria Pessoa, em todas as abas e navegadores |
| Marca de Atividade que avançou | Só a própria Pessoa, em todas as abas e navegadores |

- Uma edição que não muda as Menções, uma leitura ou marca que não avançou e o reenvio idempotente
  não publicam.
- **Ordem:** os números dependem de várias Conversas, então a fila por Conversa da F07 não basta.
  O `activity.unread` sai de uma fila em memória por Pessoa, que calcula os números na hora de
  publicar: o último evento que a aba recebe é o mais novo. As publicações que esperam a vez da
  mesma Pessoa se juntam numa só. A fila vale para uma instância da API, como as da F06 e da F07.
- **Falha na publicação:** só registrada em log (LLD, "Transações"). Os números voltam a ficar
  certos na próxima mudança, ao recarregar ou na reconexão com `reset`.
- **Alerta não é evento:** o `message.created` que cada Membro já recebe traz o autor, a Conversa e
  as Menções, e basta para o Alerta e a notificação do navegador. Uma Menção acrescentada na edição
  chega pelo `message.updated` e não alerta (PRD, "Edição e exclusão corrigem as Notificações em
  silêncio").
- **Remoção de Membro pelo comando** (F04): o comando não publica `activity.unread`; a Pessoa
  removida vê os números certos ao recarregar ou na próxima mudança dela.

### BFF (web)

- **Rotas** `GET /api/activity` (com `kind` e `before`) e `PUT /api/activity/read` (com
  `messageId` no corpo): 401, 404 e 400 como a API, e o resto como 502. São rotas, e não Server
  Actions, pelo mesmo motivo da rota de leitura da F07: a página seguinte e a marca não podem
  esperar na fila dos Server Actions da aba.
- **Serviços** `getActivity` e `getActivityUnread`, para o RSC.
- **Tipos da web:** `ActivityItem` (`kind`, `message`, `conversation`) e `ActivityUnread`
  (`activityReadMessageId`, `totalCount`, `mentionCount`, `directCount`).
- **401** leva a `GET /api/session/expired`, como na F02.

### Cliente (web)

**Números de Atividade**

- O layout das telas logadas lê `GET /v1/activity/unread` no RSC, junto com a lista de Conversas,
  e põe os números num SWR. O `activity.unread` troca os números direto no cache; na reconexão com
  `reset`, o cliente busca de novo, como a lista.

**Alerta e notificação do navegador**

- Um componente do cliente no layout logado ouve o `message.created`. A Mensagem é uma Notificação
  para a aba quando o autor não é a Pessoa e, pela lista de Conversas, a Conversa é uma Conversa
  direta, ou é um Canal e `mentions` traz a Pessoa. A decisão é uma função pura.
- **Sem Alerta do reenvio:** os eventos reenviados na reconexão chegam antes do `sync`
  (spec da F03, "Eventos por Pessoa e reconexão"). A aba só alerta depois do `sync` da conexão
  atual, e as Notificações que chegaram durante a queda só aparecem em Atividade e nos números.
- **Foco entre abas:** a aba sem foco pergunta às outras do mesmo navegador, por um
  `BroadcastChannel`, se alguma está em foco, e cada uma responde com o foco real dela (o mesmo
  critério do hook `useTabFocus` da F07); a pergunta espera as respostas um instante (150 ms) e
  confere o próprio foco de novo no fim. Sem guardar quem estava em foco, uma aba que fechou sem
  avisar, congelou ou voltou do bfcache não deixa estado velho. Sem `BroadcastChannel`, a opção do
  navegador não aparece.
- **Para onde vai a Notificação**, também numa função pura:
  - aba em foco com a Conversa da Mensagem aberta: nada;
  - aba em foco com outra Conversa ou outra tela: Alerta, só nela;
  - nenhuma aba em foco, opção do navegador ligada e permissão `granted`: notificação do navegador
    criada por todas as abas, com `tag` igual ao id da Mensagem, e o navegador mostra uma só;
  - fora disso: nada.
- **O Alerta** é um toast do Sonner (Toaster que já existe), como "Portas / Toast de atividade":
  título "Rafael Trevisani mencionou você em #geral" ou "Regina Fonseca enviou uma mensagem
  direta", o começo do texto em até duas linhas e o botão "Abrir". Some depois da "Duração do
  Alerta" (8 s, valor novo do LLD) ou pelo botão de fechar. O Toaster ganha um afastamento do fundo
  para ficar acima do campo de envio (PRD, história 1). O Sonner anuncia o toast numa região
  `aria-live` educada, sem tirar o foco, e o atalho dele (Alt+T) leva o foco aos toasts.
- **A notificação do navegador** tem o mesmo título e o começo do texto no corpo. O clique chama
  `window.focus()` na aba que a criou e navega até a Mensagem.

**Opção do navegador** (menu da conta, `user-menu.tsx`)

- Fica no `localStorage`, desligada por padrão, e só vale com `Notification.permission ===
  'granted'`. Sair e entrar de novo não apaga a opção.
- Os três estados seguem os frames do menu: "Ativar notificações do navegador"; "Desativar
  notificações do navegador" com a opção ligada e a permissão dada; e "Ativar notificações do
  navegador" com a linha "Bloqueadas neste navegador", desabilitado, com a permissão `denied`.
- Ativar com a permissão `default` chama `Notification.requestPermission()`, e só aí. Com `granted`,
  liga; com `denied`, passa a "Bloqueadas". Um navegador sem a API `Notification` não mostra o item.

**Abrir a Conversa na Mensagem**

- O Alerta, a notificação do navegador e o item de Atividade levam a
  `/conversas/:id?mensagem=:messageId`.
- A Conversa usa a ida da F06 (spec da F06, "Ir até a Mensagem citada"): rola até a Mensagem, com
  "Indo até a mensagem" se for preciso, e aplica o destaque de "Destaque por link" por 2 s. O
  destino tem prioridade sobre a "primeira Não lida" da F07, e o divisor "Novas mensagens" continua
  onde a F07 o põe. Se a Mensagem não aparece (apagada no caminho), vale o que a F06 faz com a
  Mensagem citada que não aparece.
- Depois de rolar, o cliente tira o `mensagem` da URL com `router.replace`, para recarregar a página
  não rolar de novo.
- Abrir a Conversa com a aba em foco a lê (spec da F07, "Informar a leitura"), e é isso que deixa a
  Notificação lida: não há rota de "clique".

**Tela Atividade** (`/atividade`)

- Rota no grupo das telas logadas, com a barra lateral, e a aba na query: `?aba=mencoes` ou
  `?aba=diretas`, e Todas sem query. São três abas (TabsTrigger), cada uma com o CountBadge do seu
  número: Todas com `total_count`, Menções com `mention_count`, Mensagens diretas com
  `direct_count`. A aba Tarefas dos frames fica para a F12.
- A primeira página da aba vem do RSC, como `fallbackData` de um `useSWRInfinite` por aba; rolar até
  o fim carrega a anterior pela rota do BFF, até `has_more` falso.
- O tempo real atualiza o cache das abas carregadas, em funções puras:
  - `message.created` que é Notificação entra no topo de Todas e da aba do tipo dele;
  - `message.updated` troca a Mensagem do item; se a Menção à Pessoa entrou, o item entra na
    posição dele pelo id, e se saiu, o item sai;
  - `message.deleted` tira o item.
- **Lida**, calculada no cliente: o id da Mensagem é menor ou igual ao maior entre a
  `lastReadMessageId` da Conversa (lista da F07) e a `activityReadMessageId`. A não lida tem o
  estado "Não lido" do design system (fundo `highlight-bg`, título em negrito e ponto `badge`), como
  em "Atividade / Item não lido".
- O NotificationItem é um botão: o nome acessível junta o título, o começo do texto, o tempo
  relativo e "não lida" quando for o caso. Enter abre a Mensagem.
- **Marcar tudo como lido:** desabilitado com `total_count` zero. Manda a rota de marca com o id da
  Notificação mais nova carregada em Todas (sem Todas carregada, a primeira página dela é buscada
  antes), mostra "Atividade / Marcando tudo" enquanto espera e, na falha, um toast de erro
  ("Não foi possível marcar como lido"). Os números da tela vêm só do `activity.unread`, como na
  F07.
- Carregando, erro com "Tentar de novo" e vazio de cada aba seguem os frames da seção Atividade.

**Rail**

- O `rail.tsx` ganha, abaixo do Início, o link Atividade (ícone `bell`, rótulo "Atividade"), com o
  estado ativo em `/atividade` ("Casca / Rail / Atividade ativa"); o Início deixa de ficar ativo
  ali. O link mostra o CountBadge com `total_count` e tem o nome acessível "Atividade, 3 não lidas"
  (ou só "Atividade" em zero), com o número visual escondido do leitor de tela.
- O marcador do Início da F07 continua valendo na tela Atividade, e a F08 o prova (spec da F07,
  "Título da aba e rail").

**Componentes novos**, pelo design system ("Componentes"): o NotificationItem (entity, pasta
`notification/`) e o TabsTrigger, se ainda não existir no código.

**Telas**, que reproduzem os frames do Figma (arquivo `slack`, página Telas), sem a aba Tarefas e
sem itens de Tarefa:

- "Atividade": Marcar tudo habilitado (25:15219), Marcar tudo desabilitado (25:15494), Marcando
  tudo (25:15769), Notificações carregando (25:16011), Erro (25:16253), Vazio em Todas (25:16494),
  Vazio em Menções (25:16729), Vazio em Mensagens diretas (25:16963), Item não lido (25:17233) e
  Item lido (25:17502).
- "Portas": Toast de atividade (19:3399) e Toast de erro (19:4932).
- "Casca / Rail": Atividade ativa (25:24898).
- "Casca / Menu do usuário": Ativar notificações (25:27634), Notificações bloqueadas (25:28538) e
  Notificações ligadas (25:29478).
- **Mudança no Figma, antes do código de cada tela**, pelo `docs/design-system.md` ("Do código para
  o Figma"), cada uma na tarefa da tela que a usa:
  - "Portas / Toast de atividade" com o Alerta acima do campo de envio, sem cobri-lo (hoje o frame
    o sobrepõe, e o PRD manda não cobrir);
  - o item de Mensagem direta e o de Menção no tema claro e no escuro, se faltarem.

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que aparece na tela), e não a forma interna dos services. A
forma de cada teste da API está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de ponta a ponta por HTTP com banco real:**

- a lista traz as Menções em Canais e as Mensagens de outros nas Conversas diretas, filtradas por
  `kind`, com keyset e `has_more`; não traz as próprias Mensagens, a Menção a si mesma, a Conversa
  direta consigo mesma, as apagadas, a Menção dentro de Conversa direta como item de Menção, nem as
  de um Canal privado de que a Pessoa foi removida;
- a edição que acrescenta a Menção cria o item, e a que tira o remove;
- os números contam só as não lidas, pela Última leitura ou pela marca, e param em 100;
- ler a Conversa zera as Notificações dela nos números;
- a marca avança e zera os números, sem mudar a Última leitura nem os números da lista de
  Conversas; uma posição anterior ou igual responde 200 sem mudar nada; Mensagem de Conversa de
  que a Pessoa não é Membro, ou inexistente: 404; sem Sessão: 401.

**API do chat, testes de ponta a ponta com o servidor real e `socket.io-client`:**

- a Menção num Canal entrega `activity.unread` à Pessoa mencionada e ao autor, e a ninguém mais; a
  Mensagem numa Conversa direta, à outra Pessoa e ao autor;
- a leitura de Conversa e a marca entregam `activity.unread` a todas as abas da Pessoa;
- a edição que muda Menção entrega só às Pessoas que entraram ou saíram; a exclusão, só a quem não
  tinha lido;
- o evento volta na reconexão com cursor;
- Mensagens em várias Conversas e uma marca em sequência rápida terminam, no último evento
  recebido, com os números iguais aos da rota.

**Banco, teste de ponta a ponta da migração**, no arquivo dos testes de banco: a coluna nova existe
e fica nula nas Pessoas que já existem.

**Web, Vitest para as funções puras:** se a Mensagem é Notificação para a Pessoa; para onde ela vai
(nada, Alerta ou navegador), com e sem foco, com a Conversa aberta e com a opção em cada estado; o
título do Alerta; a aplicação de `message.created`, `message.updated` e `message.deleted` no cache
das abas de Atividade; o cálculo de lida; o nome acessível do item e do link do rail; o estado da
opção do navegador a partir da permissão e do `localStorage`; a prioridade de `?mensagem=` sobre a
primeira Não lida.

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F08 junto dos testes. Duas Pessoas em dois contextos do navegador, e uma
delas com duas abas:

- uma menciona a outra num Canal; a outra, com outra Conversa aberta, vê o Alerta só na aba em
  foco; "Abrir" leva à Mensagem com o destaque, e o contador do rail desce nas duas abas;
- com a Conversa da Mensagem aberta e em foco, não há Alerta;
- com a permissão `notifications` concedida pelo contexto do Playwright, a opção ligada e nenhuma
  aba em foco, sai uma notificação do navegador só, observada por um `Notification` instrumentado
  com `addInitScript`; com a permissão negada, o menu mostra "Bloqueadas neste navegador";
- Atividade lista a Menção e a Mensagem direta nas abas certas, com os contadores; apagar a
  Mensagem tira o item sem recarregar; "Marcar tudo como lido" zera o rail e mantém o negrito da
  barra lateral;
- o marcador do Início da F07 aparece na tela Atividade;
- tudo pelo teclado, e a checagem de acessibilidade com `@axe-core/playwright` na tela Atividade
  com itens lidos e não lidos e com o Alerta na tela, sem violações.

**Medição:** o p95 de 1 s (PRD, histórias 1, 2, 4 e 5) segue o caminho medido para o
`message.created` na F03, de onde o Alerta nasce, sem medição nova; o `activity.unread` sai pela
mesma publicação, logo depois.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois
temas, comparada com o `get_screenshot` dos frames citados (`docs/design-system.md`, "Validação
visual"), registrada na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse na tela Atividade, e a notificação do navegador de verdade, no Chrome, com o chat em
segundo plano e o clique trazendo a aba para a frente.

**Exemplos anteriores:** os testes da F03 a F07, nas mesmas pastas e com as mesmas bases, em
especial os da reconexão, da ida até a Mensagem citada e dos números da F07.

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- A aba Tarefas e a Notificação de Tarefa, que entram na F12 como mais uma fonte da consulta
  (ADR 0027, "Custo aceito").
- Notificação do navegador entre navegadores diferentes: a opção e o foco valem por navegador.
- Fila de publicação entre várias instâncias da API: a fila por Pessoa vale para uma, como as da
  F06 e da F07.
- O snapshot OpenAPI das rotas novas, que segue planejado no LLD.

## Observações

- O glossário ganhou "Notificação", "Atividade" e "Alerta".
- O [ADR 0027](../../adr/0027-notificacoes-calculadas.md) decide que as Notificações são calculadas,
  e não gravadas. O HLD (seção 7, "Regras que pesam no desenho", e o conteúdo do Banco do chat)
  deixa de pôr as Notificações na transação da Mensagem, e o LLD foi atualizado nas seções
  "Concorrência e idempotência", "Dados", "Interfaces" (rotas e evento), "Cliente", "Valores de
  regra", "Decisões" e nos itens de "Questões em aberto" sobre as Notificações.
- Os nós do Figma citados vieram do levantamento feito para esta spec e podem mudar de id se os
  frames forem recriados. Nesse caso, valem os nomes.
