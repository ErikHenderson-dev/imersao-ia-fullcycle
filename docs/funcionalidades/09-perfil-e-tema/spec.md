# Spec · F09 · Perfil e tema

2026-11-10 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F09 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

## Problema

O Perfil da F05 só muda pelo comando de contas, ninguém sabe se um colega está por perto e o tema
escuro do design system não tem como ser escolhido (PRD, seção 1, "Resumo executivo").

## Solução

A tabela `people` ganha o Status, a escolha de presença e o tema, e o nome passa a ter limite. A
API ganha a edição do próprio Perfil, a gravação da escolha de presença e a do tema. A Presença é
calculada em memória pela API do chat, que conta as conexões de cada Pessoa e espera uma carência
antes de dar como ausente quem perdeu a última; a instância única da API (HLD, seção 6.2) é o que
torna isso possível. Dois eventos novos, `person.updated` e `presence.changed`, vão para todas as
Pessoas conectadas, sem passar pelos eventos por Pessoa do Redis: na conexão e na reconexão, o
cliente lê um retrato da Presença e do Status. Na web entra uma camada única de Pessoas no cliente,
que os componentes de Pessoa leem, o diálogo "Editar perfil", a escolha de presença no menu do
avatar e o botão de tema no Rail, com o tema aplicado no servidor. O fluxo completo está no PRD,
seção 2, "Fluxo".

## Histórias de usuário

As histórias 1 a 5 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá.

## Decisões de implementação

### Pessoas (API do chat)

A tabela `people` muda, `planejada`:

| Coluna | Mudança |
| --- | --- |
| `name` | Ganha a regra do cargo: de 1 a 80 caracteres, contados em code points, numa linha só, sem espaços nas pontas. CHECK escrito à mão na migração, como os da F05 |
| `status_emoji` | texto, opcional, CHECK com as sete chaves do Status ("Valores") |
| `status_text` | texto, opcional, de 1 a 100 caracteres numa linha só, CHECK como o do cargo |
| `presence_choice` | texto, obrigatório, `available` ou `away`, padrão `available` |
| `theme` | texto, obrigatório, `light` ou `dark`, padrão `light` |

- **Migração:** acrescenta as quatro colunas com os padrões e o CHECK do nome. Um nome que já
  passe da regra faz a migração falhar com a Pessoa no erro, em vez de cortar o nome em silêncio;
  as contas de desenvolvimento e de demonstração têm nomes curtos.
- **Status:** `status_text` sem `status_emoji` é gravado com a chave `speech` (💬). `status_emoji`
  sem texto é válido. Os dois nulos são o Status limpo. O emoji é guardado pela chave, e a web
  troca a chave pelo emoji e pelo nome acessível.
- **Regras dos campos:** as do cargo e do telefone continuam as da F05 (`profile-values.ts`); o
  nome e o texto do Status entram no mesmo lugar, com o mesmo `InvalidProfileError`
  (`validation_failed`).

### Presença (API do chat)

**Rastreador de presença**, um provider em memória do módulo `realtime`:

- Guarda, por Pessoa, o número de sockets conectados e um timer de carência.
- **Conexão:** soma um. Se havia um timer de carência, cancela-o, e a Pessoa continua como estava,
  sem evento. Se a Pessoa passou de zero para um, ela fica conectada.
- **Desconexão:** o gateway passa a implementar `handleDisconnect` e subtrai um. Ao chegar a zero,
  começa a "Carência da presença" (30 s, "Valores"); se ninguém reconectar até o fim, a Pessoa fica
  desconectada.
- **Presença de uma Pessoa:** `available` quando está conectada e a `presence_choice` é
  `available`; `away` em qualquer outro caso.
- **Evento:** toda mudança na Presença calculada, pela conexão, pelo fim da carência ou pela troca
  da escolha, publica `presence.changed`. Uma mudança que não muda a Presença não publica.
- **Prazo do PRD:** o socket.io percebe a conexão morta em até 15 s (ping de 10 s e timeout de 5 s,
  `realtime-values.ts`); com a carência, a Pessoa fica ausente para os outros em até uns 45 s, dentro
  do 1 minuto (PRD, história 3). Uma queda de até 30 s não chega a mudar nada.
- **Reinício da API:** o rastreador começa vazio, todos aparecem ausentes e voltam quando as abas
  reconectam. A presença não é gravada no banco nem no Redis.
- **Instância única:** o rastreador vale para uma instância, como as filas da F06 a F08. Mais de uma
  instância exige levar a contagem para o Redis (HLD, seção 11, risco da instância única).

### Rotas (API do chat)

Todas autenticadas pelo guard da F01 e com o corpo de erro da rule de erros da API
(`.claude/rules/nest-api-errors.md`). Sem Sessão, respondem `unauthenticated` (401).

| Rota | Entrada | Sucesso | Erros |
| --- | --- | --- | --- |
| `PATCH /v1/people/me`, `planejada` | `name`, `title`, `phone`, `status_emoji` e `status_text`, todos opcionais; `null` ou texto vazio apagam os opcionais | 200 com `person`, o Perfil como em `GET /v1/people/:id` | `validation_failed` (400) |
| `PUT /v1/people/me/presence`, `planejada` | `presence_choice` (`available` ou `away`) | 204 | `validation_failed` (400) |
| `PUT /v1/people/me/theme`, `planejada` | `theme` (`light` ou `dark`) | 204 | `validation_failed` (400) |
| `GET /v1/people/presence`, `planejada` | — | 200 com `people`: `id`, `presence` e `status` (`emoji` e `text`) de quem está disponível ou tem Status | — |
| `GET /v1/people/:id`, muda | — | 200 com `person`, que ganha `presence` e `status` | `person_not_found` (404) |
| `GET /v1/sessions/current`, muda | — | a Pessoa ganha `presence_choice`, `theme` e `status` | como hoje |
| `GET /v1/people` e `GET /v1/conversations/:id/members`, muda | como hoje | cada Pessoa ganha `presence` e `status` | como hoje |

- `PATCH /v1/people/me`: um campo ausente não muda; o `name` não aceita `null`. A gravação é uma
  só, e a última vence entre abas. Ela publica `person.updated` só quando algo mudou.
- `PUT /v1/people/me/presence`: a mesma escolha de novo responde 204 sem publicar.
- `PUT /v1/people/me/theme`: não publica evento; as outras abas do mesmo navegador sabem pelo
  cliente ("Tema"), e os outros navegadores leem o tema na próxima carga.
- `GET /v1/people/presence`: o retrato cresce com quem está disponível ou tem Status, e não com o
  tamanho do workspace.
- As rotas entram no controller de `profiles`, ao lado das da F05.

### Tempo real (API do chat e `packages/chat-events`)

- **Sala nova, `workspace`:** o middleware do handshake põe todo socket nela, junto de
  `person:<id>` e `session:<id>`.
- **Eventos novos, sem guardar nos eventos por Pessoa e sem reenvio na reconexão**, como o
  "digitando": entram em `ServerToClientEvents`, e não em `StoredEventPayloads`.
  - `presence.changed`: `person_id` e `presence`.
  - `person.updated`: `id`, `name`, `username`, `title` e `status`. O telefone e o e-mail não vão no
    evento; o painel de perfil os lê pela rota ao abrir.
- **Para quem:** a sala `workspace`, inclusive as abas da própria Pessoa.
- **Por que não guardar:** guardar exigiria uma escrita no stream de cada Pessoa do workspace a
  cada mudança, para um estado que o retrato recupera inteiro. A falha de publicação só fica em log
  (LLD, "Transações").
- **Nome no "digitando":** ao publicar `person.updated`, o gateway atualiza o `socket.data.person`
  dos sockets daquela Pessoa (sala `person:<id>`), para o `typing.start` sair com o nome novo.
- **Ordem:** o `person.updated` sai depois do commit. Duas edições seguidas da mesma Pessoa chegam
  na ordem em que foram publicadas, pela mesma conexão; não há fila nova.

### Módulos (API do chat)

- `people`: a entidade ganha as colunas; `profile-values.ts` ganha as regras do nome e do Status; o
  service ganha a edição do Perfil, a escolha de presença e o tema.
- `profiles`: o controller ganha as rotas novas e orquestra a gravação e a publicação.
- `realtime`: o rastreador de presença, o `handleDisconnect`, a sala `workspace`, os dois eventos no
  `RealtimePublisher` e a atualização do `socket.data.person`.
- `sessions`: a Pessoa da resposta ganha os campos novos.
- `memberships`: a busca e os Membros ganham `presence` e `status`, lidos do rastreador e da tabela.

### Comando de contas (API do chat)

Não muda: continua trocando só o cargo e o telefone (spec da F05, "Comando de contas"). Uma troca
pelo comando não publica `person.updated`; quem estiver com o chat aberto vê o cargo novo ao
recarregar ou ao abrir o perfil.

### BFF (web)

- **Server Actions:** `updateProfile` (nome, cargo, telefone e Status), `savePresenceChoice` e
  `saveTheme`. Validam a entrada com as mesmas regras da API e devolvem a união discriminada da F01
  (`ok`, `unauthenticated`, `failure`) e, em `updateProfile`, também `invalid`, com o campo e a
  mensagem de cada erro. A validação do BFF é a que preenche "Erro de campo"; um `validation_failed`
  da API que escape dela vira o erro geral.
- **Rota de leitura nova:** `GET /api/people/presence`, o retrato, chamado pelo cliente na conexão
  e no `sync`.
- **401** em qualquer uma leva a `GET /api/session/expired`, como na F02.
- **Tipos da web:** `Status` (`emoji`, chave, e `text`), `Presence` (`available` ou `away`); `Person`
  ganha `presenceChoice`, `theme` e `status`; `Profile`, `PersonEntry` e as Pessoas das listas
  ganham `presence` e `status`.
- **Regras compartilhadas:** os limites do nome, do cargo, do telefone e do texto do Status e as
  chaves dos emojis ficam num módulo da web com os valores do LLD ("Valores"), testado contra os
  mesmos casos da API.

### Cliente (web)

**Camada de Pessoas**

- Um provider no layout logado guarda um mapa de id para `name`, `initials`, `username`, `title`,
  `presence` e `status`, lido com `useSyncExternalStore`, para que só os componentes da Pessoa que
  mudou rendam de novo.
- É alimentado pelo retrato (`GET /api/people/presence`) na conexão e a cada `sync`, que troca a
  Presença e o Status de todas as entradas (quem não está no retrato fica ausente e sem Status), e
  pelos eventos `presence.changed` e `person.updated`.
- **Componentes de Pessoa** (nome, avatar com bolinha, emoji de Status) recebem o id e o que veio no
  payload, e usam a entrada da camada quando ela existe. Assim, o nome novo aparece nas Mensagens já
  carregadas, nas Citações, na barra lateral, nos Membros, nos resultados de busca, no cabeçalho da
  Conversa direta e no "digitando", sem buscar de novo nenhum histórico.
- **Nome perdido durante uma queda:** o `person.updated` não é reenviado, e o retrato não traz
  nomes. Um nome trocado enquanto a aba estava desconectada aparece ao recarregar; risco aceito,
  porque a troca de nome é rara. Na reconexão, o cliente revalida a lista de Conversas e o perfil
  aberto, que já vêm com o nome atual.
- A própria Pessoa entra na camada com os dados de `GET /v1/sessions/current`; o Rail e o menu do
  avatar passam a ler dela, e a Presença dela, enquanto a aba está aberta, é a escolha.

**Componentes novos**, pelo design system ("Componentes"): PresenceDot (primitivo), UserStatus
(entity, o emoji com a mensagem no Tooltip e no nome acessível), ThemeToggle (widget) e o diálogo
"Editar perfil". O UserAvatar ganha a bolinha, com o recorte do fundo (`Backdrop`) de cada lugar.

**Onde aparecem a Presença e o Status** (PRD, história 4): barra lateral (Mensagens diretas),
painel de perfil (Presença, emoji e texto por inteiro), avatar do Rail, cabeçalho do menu do
avatar, autor de cada Mensagem (só no layout `full` do MessageItem, que mostra o nome), lista
"Membros de #nome", resultados de "Nova conversa" e de "Adicionar pessoas", e cabeçalho da Conversa
direta. Não aparecem no Alerta nem nos itens de Atividade.

**Editar perfil**

- Abre pelo item "Editar perfil" do menu do avatar e pelo botão "Editar perfil" do próprio perfil,
  preenchido com os dados da camada. Diálogo do Radix, com o foco em "Nome completo" e a volta do
  foco ao fechar.
- Os sete emojis são um grupo de rádio (`role="radiogroup"`), com as setas entre eles; Enter ou
  espaço no marcado o desmarca.
- "Salvar" chama `updateProfile`; enquanto espera, "Salvando". `invalid` põe a mensagem embaixo de
  cada campo ("Erro de campo") e o foco no primeiro com erro; `failure`, o "Erro geral" no topo do
  diálogo. `ok` fecha o diálogo e aplica o Perfil na camada sem esperar o evento.

**Escolha de presença**

- O cabeçalho do menu do avatar ganha a linha de Presença ("Disponível" ou "Ausente") e o item
  "Definir como ausente" ou "Definir como disponível", como os frames do menu.
- O item aplica a escolha na camada na hora e chama `savePresenceChoice`; na falha, volta ao
  anterior e mostra o toast de erro ("Não foi possível mudar a presença").

**Tema**

- A escolha fica na Pessoa, e o cookie `theme` a espelha no navegador para a primeira pintura: o
  projeto usa Cache Components, e o layout raiz não pode ler a Sessão fora de um `<Suspense>`, que
  não pode envolver o `<html>`. Um script curto e bloqueante no `<head>` lê o cookie e põe
  `data-theme` e `color-scheme` no `<html>` antes da pintura, fora de "Entrar", que fica no claro.
- Entrar grava o cookie com o tema da Pessoa (o navegador novo já abre no tema dela); o
  ThemeProvider das telas logadas o corrige quando a Pessoa trocou o tema em outro navegador; sair
  e a Sessão vencida o apagam. O tema das telas logadas fica nesse provider, e os botões de tema (o
  do Rail e a cópia dele na gaveta) só o leem. Isso
  fecha o "onde a escolha é gravada" do design system ("Tema claro e escuro").
- O ThemeToggle, no Rail, acima do avatar, troca o `data-theme` e o cookie na hora, chama
  `saveTheme` (que só grava na Pessoa) e avisa as outras abas do navegador por um `BroadcastChannel`, que trocam o
  `data-theme` delas. Na falha, o tema volta ao anterior nas abas e um toast mostra "Não foi
  possível trocar o tema". O nome acessível é "Mudar para o tema escuro" ou "Mudar para o tema
  claro".

**Telas**, que reproduzem os frames do Figma (arquivo `slack`, página Telas):

- "Diálogos / Editar perfil": Padrão (26:38120), Erro de campo (26:38947), Erro geral (26:39774) e
  Salvando (26:40602).
- "Casca / Menu do usuário": Disponível (25:25749) e Ausente (25:26689).
- "Painel de perfil": Outra pessoa (26:43588) e Próprio perfil (26:44497).
- O botão de tema e a bolinha no avatar do Rail, nos frames da casca.
- **Mudança no Figma, antes do código de cada tela**, pelo `docs/design-system.md` ("Do código para
  o Figma"), cada uma na tarefa da tela que a usa:
  - a Presença e o emoji de Status no autor da Mensagem, em "Membros de #nome", nos resultados de
    "Nova conversa" e no cabeçalho da Conversa direta;
  - o painel de perfil com o texto do Status;
  - o diálogo "Editar perfil" com o Status limpo;
  - os frames novos e os desta lista no tema claro e no escuro, se faltarem.

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que aparece na tela), e não a forma interna dos services. A
forma de cada teste da API está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de unidade do rastreador de presença, com timers falsos:** a primeira conexão
deixa disponível quem escolheu disponível; a segunda aba não publica; fechar uma de duas abas não
muda nada; fechar a última só deixa ausente depois da carência; reconectar dentro da carência não
publica nada; trocar a escolha com a Pessoa conectada publica, e desconectada não publica.

**API do chat, testes de ponta a ponta por HTTP com banco real:**

- `PATCH /v1/people/me` grava o nome, o cargo, o telefone e o Status, apaga os opcionais com `null`
  ou vazio, grava `speech` no texto sem emoji, e recusa com `validation_failed` o nome vazio, com
  quebra de linha ou acima de 80, o texto do Status acima de 100 e a chave fora das sete;
- a escolha de presença e o tema são gravados, voltam em `GET /v1/sessions/current` e recusam valor
  fora da lista;
- o Perfil, a busca e os Membros trazem `presence` e `status`; o retrato traz só quem está
  disponível ou tem Status;
- sem Sessão: 401.

**API do chat, testes de ponta a ponta com o servidor real e `socket.io-client`:**

- a edição do Perfil entrega `person.updated` a todas as Pessoas conectadas, inclusive às outras
  abas de quem editou, e a edição sem mudança não entrega;
- conectar a primeira aba de quem escolheu disponível entrega `presence.changed` aos outros;
  desconectar a última entrega `away` depois da carência, reduzida pela configuração do teste;
- "Definir como ausente" com a Pessoa conectada entrega `presence.changed`;
- depois de editar o nome, o `typing.start` sai com o nome novo;
- os eventos novos não voltam na reconexão com cursor.

**Banco, teste de ponta a ponta da migração**, no arquivo dos testes de banco: as colunas novas
existem com os padrões nas Pessoas que já existem, e os CHECKs recusam nome longo, chave inválida e
texto de Status com quebra de linha.

**Web, Vitest para as funções puras:** as regras compartilhadas dos campos; a aplicação do retrato,
de `presence.changed` e de `person.updated` na camada de Pessoas; a escolha entre a camada e o
payload; o nome acessível do ThemeToggle, do UserStatus e da bolinha.

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F09 junto dos testes. Duas Pessoas em dois contextos do navegador:

- uma edita o nome e o Status, e a outra vê o nome novo numa Mensagem antiga, na barra lateral e no
  perfil, e o emoji com a mensagem no Tooltip, sem recarregar;
- o nome vazio mostra o "Erro de campo" e mantém o diálogo aberto;
- "Definir como ausente" troca a bolinha para a outra; fechar o contexto troca para ausente depois da
  carência, reduzida pela configuração do ambiente de teste;
- o tema escuro troca nas duas abas do mesmo contexto e vem aplicado num contexto novo da mesma
  Pessoa, sem o claro na primeira pintura (o `data-theme` já está no HTML do servidor);
- tudo pelo teclado, e a checagem de acessibilidade com `@axe-core/playwright` no diálogo, no menu e
  no painel de perfil, nos dois temas, sem violações.

**Medição:** o p95 de 1 s das histórias 1 a 3 do PRD segue o caminho medido para o
`message.created` na F03: os eventos novos saem pela mesma publicação, sem gravação no Redis, e não
precisam de medição nova.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois
temas, comparada com o `get_screenshot` dos frames citados (`docs/design-system.md`, "Validação
visual"), registrada na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse nos dois temas, na Conversa com o painel de perfil aberto e com o diálogo "Editar
perfil" aberto.

**Exemplos anteriores:** os testes da F03 a F08, nas mesmas pastas e com as mesmas bases, em
especial os do "digitando", da reconexão e do perfil da F05.

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- Presença e rastreador entre várias instâncias da API: valem para uma, como as filas da F06 a F08.
- Reenvio de `person.updated` e `presence.changed` na reconexão: o retrato cobre a Presença e o
  Status, e o nome perdido numa queda aparece ao recarregar.
- Publicar `person.updated` nas trocas feitas pelo comando de contas.
- O snapshot OpenAPI das rotas novas, que segue planejado no LLD.

## Observações

- O glossário ganhou "Status" e "Presença", e "Perfil" passou a listar os dois. O andamento do envio
  de uma Mensagem passa a ser chamado de "estado de envio" nos documentos novos.
- O LLD foi atualizado nas seções "Dados", "Interfaces" (rotas e eventos), "Estados e regras" (6.4,
  Presença), "Cliente" (tema e camada de Pessoas), "Valores de regra" e "Questões em aberto". O HLD
  não muda: a presença por WSS e a instância única já estão nele.
- Sem ADR: a presença em memória depende da instância única, que o HLD já decide e registra como
  risco.
- Os nós do Figma citados vieram do levantamento feito para esta spec e podem mudar de id se os
  frames forem recriados. Nesse caso, valem os nomes.
