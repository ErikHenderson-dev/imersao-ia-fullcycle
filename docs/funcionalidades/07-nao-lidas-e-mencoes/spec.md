# Spec · F07 · Não lidas e menções

2026-11-10 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F07 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

## Problema

A barra lateral não diz onde há Mensagens Não lidas nem onde a pessoa foi mencionada, e abrir uma
Conversa não leva a onde ela parou (PRD, seção 1, "Resumo executivo").

## Solução

Cada participação numa Conversa passa a guardar a Última leitura, como o id da última Mensagem
lida. Os números de Não lidas e de Menções saem de uma contagem a partir dela, e não de contadores
gravados ([ADR 0026](../../adr/0026-nao-lidas-calculadas-da-ultima-leitura.md), que substitui a
0021): a exclusão e a edição que muda Menção se corrigem sozinhas. A lista de Conversas passa a
trazer os números; uma rota nova grava a leitura; um evento novo, `conversation.unread`, leva os
números a todas as abas de cada Membro afetado, calculados pelo servidor. Na web, a barra lateral
ganha o negrito e o contador, a Conversa abre na primeira Não lida com o divisor "Novas mensagens",
e o título da aba e o rail avisam que há algo novo. O fluxo completo está no PRD, seção 2, "Fluxo".

## Histórias de usuário

As histórias 1 a 5 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá.

## Decisões de implementação

### Última leitura e contagem (API do chat)

A tabela `conversation_members` muda, `planejada`:

| Coluna ou regra | Mudança |
| --- | --- |
| `last_read_message_id` | uuid, opcional, referência a `messages`, sem cascata (a exclusão de Mensagem é lógica). Nulo: nenhuma Mensagem lida |

**Migração:** acrescenta a coluna e preenche cada participação que já existe com o id da última
Mensagem da Conversa, apagada ou não (o maior id), ou nulo se a Conversa não tem Mensagens. Assim,
quem já usa o chat começa com tudo lido, sem uma avalanche de Não lidas no dia da entrega.

**Onde a Última leitura começa**, na gravação da participação:

| Como a Pessoa vira Membro | Última leitura inicial |
| --- | --- |
| Cria um Canal | Nula (o Canal não tem Mensagens) |
| É adicionada a um Canal privado (F04) | O maior id de Mensagem da Conversa, ou nulo |
| Conta nova adicionada aos Canais públicos | O maior id de Mensagem de cada Canal, ou nulo |
| Abre uma Conversa direta (F05) | O maior id de Mensagem da Conversa, ou nulo |
| A outra Pessoa da Conversa direta, na primeira Mensagem (ADR 0025) | Nula: a Mensagem que abriu a Conversa direta conta como Não lida |

O histórico anterior à entrada não conta (PRD, "Regras desta funcionalidade", "Ao entrar numa
Conversa").

**Avançar a Última leitura:**

- Só avança: a atualização grava só se a posição gravada for nula ou anterior à nova
  (`last_read_message_id IS NULL OR last_read_message_id < :novo`), como já diz o LLD
  ("Concorrência e idempotência", "Última leitura"). Os ids são UUID v7, em ordem de criação, e a
  comparação é a do próprio uuid.
- **Leitura pedida pelo cliente** (rota em "Rotas"): a Mensagem precisa ser da Conversa, apagada ou
  não, porque é só uma posição.
- **Envio:** enviar uma Mensagem avança a Última leitura do autor até ela, na mesma transação do
  envio. O reenvio idempotente não muda nada. Assim, as próprias Mensagens nunca deixam Não lidas
  para trás, e a Pessoa que escreve numa Conversa a lê.

**A contagem**, numa função só da API, usada pela lista de Conversas, pela rota de leitura e pelo
evento:

- **Não lidas** de uma Pessoa numa Conversa: as Mensagens da Conversa com id posterior à Última
  leitura (todas, se nula), de outro autor e com `deleted_at` nulo.
- **Menções:** as mesmas Mensagens, cruzadas com `message_mentions` da Pessoa. A unicidade
  (`message_id`, `person_id`) já faz a Menção repetida contar uma vez.
- A própria Pessoa nunca conta: as Mensagens dela ficam fora pelo autor, e com elas a Menção a si
  mesma e a Conversa direta consigo mesma.
- As duas contagens param em 100 (subconsulta com `LIMIT 100`, pelo índice `(conversation_id, id)`
  de `messages`): a web mostra `99+` acima de 99, e um Membro que nunca lê um Canal movimentado
  não custa mais que 100 linhas.
- **Em lote:** a mesma função conta para várias Conversas de uma Pessoa (a lista) ou para vários
  Membros de uma Conversa (o evento), numa consulta só, com uma subconsulta lateral por linha.
- A edição que muda Menção e a exclusão não gravam nada a mais: a contagem seguinte já reflete a
  mudança. O item do LLD sobre o que a exclusão e a edição fazem com os contadores fica resolvido
  do lado da F07.

### Rotas (API do chat)

Todas autenticadas pelo guard da F01 e com o corpo de erro da rule de erros da API
(`.claude/rules/nest-api-errors.md`). Sem Sessão, respondem `unauthenticated` (401).

| Rota | Entrada | Sucesso | Erros |
| --- | --- | --- | --- |
| `GET /v1/conversations`, muda | Como hoje | Como hoje, e cada Conversa ganha `last_read_message_id`, `unread_count` e `mention_count` | Os de hoje |
| `GET /v1/conversations/:conversationId`, muda | Como hoje | Como hoje, e a Conversa ganha os mesmos três campos da lista: a página da Conversa começa pela Última leitura dela, sem ler a lista inteira | Os de hoje |
| `PUT /v1/conversations/:conversationId/read`, `planejada` | `message_id` | 200 com `conversation_id`, `last_read_message_id`, `unread_count` e `mention_count` | `conversation_not_found` (404), `message_not_found` (404), `validation_failed` (400) |

- `PUT .../read`: quem não é Membro recebe `conversation_not_found`, como nas outras rotas da
  Conversa. Mensagem que não existe ou é de outra Conversa: `message_not_found`. Uma posição igual
  ou anterior à gravada responde 200 com a posição e os números atuais, sem gravar nem publicar
  (idempotente, para o agrupamento e a aba atrasada do cliente).
- A ordem da lista não muda (Canais e depois Conversas diretas, por nome): ordenar pelas Não lidas
  está fora (PRD, "O que não é objetivo").

### Tempo real (API do chat e `packages/chat-events`)

- **Evento novo, `conversation.unread`:** `conversation_id`, `last_read_message_id`,
  `unread_count` e `mention_count`, guardado nos eventos por Pessoa e reenviado na reconexão, como o
  `message.created` (spec da F03, "Eventos por Pessoa e reconexão"). Entra em
  `StoredEventPayloads`, em `ServerToClientEvents` e na lista de eventos reenviados.
- **Para quem**, depois do commit e dos eventos de Mensagem da mesma mudança:

| Mudança | Quem recebe |
| --- | --- |
| Mensagem enviada | Todos os Membros, inclusive o autor (as outras abas dele recebem a Última leitura nova) |
| Edição que muda as Menções | As Pessoas que entraram ou saíram de `message_mentions` |
| Mensagem apagada | Os Membros, menos o autor, com a Última leitura nula ou anterior à Mensagem |
| Leitura que avançou | Só a própria Pessoa, em todas as abas e navegadores |

- Uma edição que não muda as Menções, uma leitura que não avançou e o reenvio idempotente não
  publicam.
- **Ordem:** os números são calculados na hora de publicar, dentro de uma fila em memória por
  Conversa na API, como a fila por Mensagem da F06 (LLD, "Concorrência e idempotência"). Cada
  evento reflete o banco no momento em que sai, e os eventos de uma Conversa saem um depois do
  outro, então o último que a aba recebe é o mais novo. As publicações que esperam a vez na mesma
  Conversa se juntam numa só, com todas as Pessoas delas, e a fila não segura a da Mensagem. A
  fila vale para uma instância da API, como a da F06.
- **Falha na publicação:** só registrada em log, como as outras (LLD, "Transações"). Os números
  voltam a ficar certos na próxima mudança daquela Conversa, ao recarregar ou na reconexão com
  `reset`.
- **Custo:** cada Mensagem enviada num Canal público gera um `conversation.unread` por Pessoa do
  workspace, além do `message.created`, e uma consulta agrupada com uma subconsulta limitada por
  Membro. É o custo aceito no ADR 0026.

### BFF (web)

- **Rota** `PUT /api/conversations/:id/read`, com `messageId` no corpo: devolve os números no 200;
  401, 404 e 400 como a API, e o resto como 502. É uma rota, e não um Server Action, porque os
  Server Actions de uma aba rodam em série: o aviso de leitura, que sai sozinho a cada Mensagem que
  chega, seguraria o envio e a edição atrás dele (LLD, "Cliente", "Leituras e tempo real").
- **A Conversa de `getConversation`** passa a trazer a Última leitura e os números.
- **O tipo `Conversation` da web** ganha `lastReadMessageId`, `unreadCount` e `mentionCount`.
- **401** leva a `GET /api/session/expired`, como na F02.

### Cliente (web)

**Foco da aba**

- Um hook diz se a aba está em foco: `document.visibilityState === 'visible'` e
  `document.hasFocus()`, atualizado por `visibilitychange`, `focus` e `blur` da janela. É o "aba
  em foco" do PRD.

**Informar a leitura**

- Com a Conversa aberta, a aba em foco e o histórico carregado, o cliente chama
  a rota de leitura com o id da Mensagem salva mais nova da lista, quando ele é posterior à
  Última leitura conhecida: ao abrir a Conversa, quando a aba volta ao foco e quando chega uma
  Mensagem com a aba em foco.
- As chamadas de uma Conversa são agrupadas em no máximo uma por segundo, com a última posição do
  intervalo (valor no LLD, "Valores de regra"). A Mensagem `sending` ou `failed` não conta; a
  enviada já avança a leitura no servidor.
- Os números da lista vêm só do `conversation.unread`, e não da resposta da leitura: a resposta,
  contada fora da fila da Conversa, pode chegar depois de um evento mais novo. A falha não mostra
  nada: a próxima ocasião tenta de novo.

**Lista de Conversas e barra lateral**

- O SWR da lista (`conversation-list.tsx`) recebe os números do RSC e da busca na reconexão com
  `reset`, como hoje. O `conversation.unread` troca os quatro campos da Conversa pelo id, numa
  função pura, e descarta o evento cuja `last_read_message_id` é anterior à que o cache já tem.
- A Conversa aberta com a aba em foco é exibida sem negrito e sem contador, qualquer que seja o
  número no cache: entre a Mensagem chegar e a leitura voltar, a linha não pisca.
- A SidebarRow ganha o estado Não lida (`font-black`, design system, "Estados") e o CountBadge:
  num Canal, com `mentionCount`, quando maior que zero; numa Conversa direta, com `unreadCount`.
- A linha anuncia ao leitor de tela o nome e o que há de novo, como no PRD ("geral, não lidas, 2
  menções", "Alfredo Luiz, 3 mensagens não lidas"), com o número visual escondido do leitor para
  não ser lido duas vezes. O texto sai de uma função pura.
- Uma SidebarSection recolhida continua mostrando as Conversas dela com Não lidas, com o negrito e
  o contador.

**Abrir na primeira Não lida e o divisor**

- Ao abrir uma Conversa, o cliente guarda a Última leitura da lista naquele momento. A primeira
  Não lida é a primeira Mensagem da lista, de outro autor, com id posterior a ela; o UnreadDivider
  "Novas mensagens" fica logo acima, como em "Conversa / Lista / Divisor de novas mensagens".
- Se a primeira Não lida está na página carregada e cabe na tela junto com o fim da lista, a
  Conversa abre no fim, como hoje. Se não cabe, a Conversa rola até ela, com o divisor no topo da
  área visível.
- Se não está na página carregada (a página começa depois da Última leitura e há mais), a Conversa
  usa a ida da F06-T07 (spec da F06, "Ir até a Mensagem citada"): mostra "Indo até a mensagem" e
  carrega páginas anteriores de 100 até a que contém a primeira Não lida ou começa antes dela.
  Com a Última leitura nula, carrega até o começo do histórico. Enquanto carrega, o divisor não
  aparece; se uma página falha, a Conversa fica onde está, sem divisor, porque ele ficaria acima de
  uma Mensagem com Não lidas antes dela. A primeira Não lida mostra sempre o nome e o avatar de
  quem a escreveu, logo abaixo do divisor.
- O divisor não se move enquanto a pessoa fica na Conversa: as Mensagens que chegam com a aba em
  foco entram abaixo dele, já lidas. Trocar de Conversa e voltar recalcula, sem divisor se não
  houver Não lidas.
- Quando a aba volta ao foco com a Conversa aberta, o cliente guarda de novo a Última leitura
  antes de informar a leitura; se chegaram Mensagens sem foco, o divisor passa para cima da
  primeira delas. A rolagem não muda: a pílula "Novas mensagens" da F03 continua valendo.
- O divisor é recalculado a partir da lista, então a primeira Não lida apagada leva o divisor para
  a seguinte, e sem Não lidas não há divisor.
- A decisão de onde abrir e onde fica o divisor são funções puras.

**Título da aba e rail**

- Um componente do cliente no layout das telas logadas põe no `document.title` a soma dos
  contadores visíveis da barra lateral (Menções dos Canais e Não lidas das Conversas diretas, sem a
  Conversa aberta em foco) entre parênteses, como "(3) Full Cycle Chat", e `(99+)` acima de 99; sem
  contador, só "Full Cycle Chat". Reaplica a cada navegação, porque o Next.js troca o título.
- O ícone Início do Rail (`rail.tsx`) ganha um ponto na cor `badge` quando há ao menos uma Conversa
  com Não lidas, fora a aberta em foco, também na tela Atividade. O rótulo acessível do Início passa
  a dizer "Início, há mensagens não lidas" nesse caso.
  A tela Atividade chega com a F08: até lá, o marcador vale no rail de todas as telas logadas, e
  a F08 prova que ele também aparece nela.

**Componentes novos**, pelo design system ("Componentes"): o CountBadge, primitivo sem estado
(`99+` acima de 99, some em zero, `bg-badge text-on-badge`, `rounded-pill`), e o UnreadDivider.

**Telas**, que reproduzem os frames do Figma (arquivo `slack`, página Telas):

- "Casca / Sidebar": Com dados (25:20064) e Seção recolhida (25:20813).
- "Casca / Rail": Início ativo (25:24628) e Atividade ativa (25:24898).
- "Conversa / Lista": Divisor de novas mensagens (21:7793), Indo até a mensagem (21:10072) e Novas
  mensagens abaixo (21:9308).
- **Mudança no Figma, antes do código de cada tela**, pelo `docs/design-system.md` ("Do código para
  o Figma"), cada uma na tarefa da tela que a usa:
  - criar a Conversa direta com contador de Não lidas na barra lateral;
  - criar o marcador de Não lidas no ícone Início do rail, nas duas telas do rail;
  - criar a seção recolhida com Conversas Não lidas visíveis.

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que aparece na tela), e não a forma interna dos services. A
forma de cada teste da API está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de ponta a ponta por HTTP com banco real:**

- a lista traz os números: Mensagens de outros depois da Última leitura contam; as próprias, as
  apagadas e as anteriores não; a Menção conta uma vez por Mensagem; a Menção a si mesma e a
  Conversa direta consigo mesma não contam; a contagem para em 100;
- a edição que acrescenta ou tira a Menção de uma Mensagem Não lida muda `mention_count`; a
  exclusão de uma Não lida tira das duas contagens; a edição de uma Mensagem já lida não muda nada;
- a leitura avança e zera; uma posição anterior ou igual responde 200 sem mudar nada; Mensagem de
  outra Conversa ou inexistente: 404; quem não é Membro: 404; sem Sessão: 401;
- enviar avança a Última leitura do autor;
- onde a Última leitura começa: adicionado a um Canal privado com histórico não tem Não lidas; a
  conta nova nos Canais públicos também não; a outra Pessoa da Conversa direta tem a primeira
  Mensagem como Não lida.

**API do chat, testes de ponta a ponta com o servidor real e `socket.io-client`**, como os da F03 a
F06:

- a Mensagem enviada entrega `conversation.unread` a cada Membro com os números dele, e ao autor
  com a Última leitura nova; não entrega a quem não é Membro;
- a leitura entrega `conversation.unread` zerado a todas as abas da Pessoa, e a ninguém mais;
- a edição que muda Menção entrega só às Pessoas que entraram ou saíram; a exclusão entrega só a
  quem ainda não tinha lido;
- o evento volta na reconexão com cursor;
- várias Mensagens e uma leitura em sequência rápida terminam, no último evento recebido, com os
  números iguais aos da lista.

**Banco, teste de ponta a ponta da migração**, no arquivo dos testes de banco: as participações que
já existem ficam com a Última leitura na última Mensagem da Conversa, ou nula sem Mensagens.

**Web, Vitest para as funções puras:** a aplicação do `conversation.unread` no cache, com o
descarte do evento de Última leitura anterior; o que a linha exibe (negrito, contador de Menções ou
de Não lidas, Conversa aberta em foco) e o rótulo do leitor de tela; a soma do título com `99+`; a
primeira Não lida, o lugar do divisor e a decisão de abrir no fim, rolar até ela ou ir até ela; o
agrupamento das chamadas de leitura.

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F07 junto dos testes. Duas Pessoas em dois contextos do navegador, e uma
delas com duas abas:

- uma menciona a outra num Canal; a outra, com outra Conversa aberta, vê o Canal em negrito com o
  contador 1, o título com "(1)" e o marcador no Início;
- uma Mensagem numa Conversa direta mostra o contador de Não lidas na outra Pessoa;
- abrir o Canal tira o negrito e o contador nas duas abas;
- com mais Não lidas que uma página, abrir a Conversa vai até a primeira, com o divisor acima;
- apagar a Mensagem com a Menção zera o contador na outra Pessoa sem recarregar;
- a aba em segundo plano (`page.evaluate` sobre a visibilidade, ou duas páginas alternando o
  foco) não marca como lida;
- tudo pelo teclado, e a checagem de acessibilidade com `@axe-core/playwright` na barra lateral com
  Não lidas e na Conversa com o divisor, sem violações.

**Medição:** o p95 de 1 s (PRD, história 5) segue o caminho medido para o `message.created` na F03,
sem medição nova; o `conversation.unread` sai pela mesma publicação, logo depois.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois
temas, comparada com o `get_screenshot` dos frames citados (`docs/design-system.md`, "Validação
visual"), registrada na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse com a barra lateral com Não lidas e a Conversa com o divisor.

**Exemplos anteriores:** os testes da F03 a F06, nas mesmas pastas e com as mesmas bases, em
especial os do envio de Mensagem, da edição e exclusão, da reconexão e da ida até a Mensagem citada.

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- Paginação para baixo a partir da Última leitura (`after`): a ida da F06-T07 basta no MVP.
- Sinal no favicon da aba.
- Fila de publicação entre várias instâncias da API: a fila por Conversa vale para uma, como a da
  F06.
- O snapshot OpenAPI das rotas novas, que segue planejado no LLD.

## Observações

- O glossário ganhou "Última leitura" e "Não lida".
- O [ADR 0026](../../adr/0026-nao-lidas-calculadas-da-ultima-leitura.md) substitui o 0021: os
  números são calculados a partir da Última leitura, e não gravados. O HLD (seção 7, "Regras que
  pesam no desenho") deixa de pôr a contagem de Não lidas na transação da Mensagem, e o LLD foi
  atualizado nas seções "Concorrência e idempotência" (Última leitura e contagem), "Dados",
  "Interfaces" (rotas e evento), "Cliente", "Valores de regra", "Decisões" e nos itens de
  "Questões em aberto" sobre os contadores.
- Os nós do Figma citados vieram do levantamento feito para esta spec e podem mudar de id se os
  frames forem recriados. Nesse caso, valem os nomes.
