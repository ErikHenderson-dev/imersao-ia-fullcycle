# Spec · F04 · Criação de canais e convite para canal privado

2026-11-09 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F04 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

O PRD fala em "convidar"; o termo do domínio é **adicionar ao Canal**, porque a Pessoa vira Membro
na hora, sem aceite, e "Convite" é o chamado da F15 (glossário, "Canal" e "Convite"). Esta spec usa
"adicionar".

## Problema

Os Canais só existem por script, todos incluem o workspace inteiro, e o time não tem como abrir o
Canal de que precisa nem conversar só com algumas Pessoas (PRD, seção 1, "Resumo executivo").

## Solução

A Pessoa cria um Canal pelo diálogo "Criar canal", que chama a API do chat por um Server Action. O
Canal público grava a participação de todas as Pessoas, como na F02; o privado, só a de quem o
criou, e qualquer Membro dele adiciona outras Pessoas, escolhidas por uma busca. Cada gravação
publica, depois do commit, o evento `conversation.member_added` para os Membros, pelo mesmo caminho
do `message.created` da F03, e a barra lateral, que passa a ter um cache no cliente, insere o Canal
sem recarregar. A conferência de participação da F02 já esconde o Canal privado de quem não é
Membro. O fluxo completo está no PRD, seção 2, "Fluxo".

## Histórias de usuário

As histórias 1 a 6 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá. Esta spec acrescenta a de quem opera a instalação, que o PRD cita no risco do Membro
adicionado por engano:

7. Como operação, quero remover uma Pessoa de um Canal privado, para corrigir uma adição por engano
   até a F17.

## Decisões de implementação

### Conversas (API do chat)

A tabela `conversations` da F02 (spec da F02, "Conversas e participação") muda, `planejada`:

| Coluna | Mudança |
| --- | --- |
| `kind` | O `CHECK` aceita `public_channel` e `private_channel` |
| `name` | Obrigatório nos dois tipos de Canal. A unicidade continua entre todos os Canais, públicos e privados (PRD, "Regras de Canal nesta funcionalidade") |
| `created_by` | uuid, opcional, referência a `people`; apagar a Pessoa deixa nulo. Quem criou o Canal pelo produto; os Canais do comando ficam sem |
| `client_id` | uuid, opcional. Identificador gerado no cliente, para a criação sem duplicar |

Unicidade parcial em (`created_by`, `client_id`) onde os dois não são nulos.

- **Criação:** uma transação só, que toma a mesma trava de participação da F02 (LLD, "Concorrência
  e idempotência", "Participação em Canal público") para os dois tipos, e nessa ordem:
  1. Se já existe um Canal com o mesmo (`created_by`, `client_id`), devolve esse Canal, com o
     mesmo 201, sem gravar nem publicar nada. O nome e o Tópico do reenvio são ignorados, como no
     envio de Mensagem.
  2. Valida o nome e o Tópico pela regra da F02 (spec da F02, "Comando de canais").
  3. Confere o nome entre todos os Canais; repetido, `channel_name_taken`.
  4. Grava o Canal e as participações: todas as Pessoas no público, só quem criou no privado.
- **Conta nova:** continua entrando só nos Canais públicos, sem mudança.
- **Adicionar ao Canal:** passa pela conferência de participação ("Conversa da qual a Pessoa é
  Membro"); depois, se o Canal não é privado, `members_not_editable`. Os ids que não são de
  nenhuma Pessoa recusam o pedido inteiro com `validation_failed`. A gravação tolera a participação
  que já existe, e a resposta traz só as Pessoas adicionadas agora.
- **Ordem alfabética:** as listas por nome (Conversas, Membros, Pessoas da busca) são ordenadas na
  aplicação por `Intl.Collator('pt-BR')`, e não pela collation do banco, para a web, que insere o
  Canal pelo evento, usar a mesma ordem que a API devolve ao recarregar. A ordem fica numa função
  pura usada pelos dois projetos, cada um com a sua cópia.

### Busca de Pessoas (API do chat)

- Pelo nome, sem diferenciar maiúsculas, minúsculas e acentos: `unaccent(lower(name))` contém
  `unaccent(lower(q))`. A extensão `unaccent` entra numa migração; no Postgres 18 ela é confiável
  e o dono do banco a cria. Os caracteres `%`, `_` e `\` do texto valem como literais.
- `not_member_of` é obrigatório nesta funcionalidade: quem busca precisa ser Membro daquela Conversa
  (a mesma conferência de participação), e os Membros dela ficam fora do resultado.
- Até o `limite da busca de Pessoas` (LLD, "Valores e configuração"), em ordem alfabética. Com `q`
  vazio, as primeiras em ordem alfabética.
- A F05 reaproveita a rota, com o `@usuário` e sem `not_member_of`.

### Rotas (API do chat)

Todas `planejadas`, autenticadas pelo guard da F01 e com o corpo de erro da rule de erros da API
(`.claude/rules/nest-api-errors.md`). Sem Sessão, respondem `unauthenticated` (401).

| Rota | Entrada | Sucesso | Erros |
| --- | --- | --- | --- |
| `POST /v1/conversations` | `kind` (`public_channel` ou `private_channel`), `name`, `topic` (opcional), `client_id` (uuid) | 201 com `conversation` | `channel_name_taken` (409), `validation_failed` (400) |
| `GET /v1/conversations/:id/members` | — | 200 com `members` (`id`, `name`), em ordem alfabética | `conversation_not_found` (404) |
| `POST /v1/conversations/:id/members` | `person_ids`: de 1 até as `Pessoas por adição ao Canal`, sem repetir | 200 com `added_person_ids` e `member_count` | `conversation_not_found` (404), `members_not_editable` (409), `validation_failed` (400) |
| `GET /v1/people` | `q` (opcional), `not_member_of` (id de Conversa) | 200 com `people` (`id`, `name`) | `conversation_not_found` (404), `validation_failed` (400) |

- **Conversa na resposta**, em todas as rotas que a devolvem, inclusive as da F02: ganha
  `member_count`, a quantidade de Membros.
- **Lista de Conversas** (`GET /v1/conversations`): passa a ordenar pela regra "Ordem alfabética".
- O nome repetido devolve o nome normalizado no `detail`, para o diálogo mostrar "Já existe um canal
  chamado #nome.".
- Os códigos novos, `channel_name_taken` e `members_not_editable`, entram no catálogo de códigos e
  nos mapas de status e de `detail` do filter global. O `ChannelNameTakenError` do comando passa a
  ter código HTTP.

### Módulos (API do chat)

- `conversations`: o service ganha criar Canal pelo produto, adicionar ao Canal, listar Membros e
  remover Membro (comando). O controller ganha as três rotas de Conversas. O service que orquestra
  a criação e a adição publica o evento depois do commit, como o envio de Mensagem.
- `people`: o service ganha a busca, e um controller novo, a rota `GET /v1/people`. A conferência
  de `not_member_of` chama o service de Conversas.
- `realtime`: o publisher ganha `memberAdded`, com o mesmo tratamento do Redis fora ou travado da
  F03 (spec da F03, "Eventos por Pessoa e reconexão").

### Comando de canais (API do chat)

A operação nova do comando da F02 (spec da F02, "Comando de canais"):

| Operação | Recebe | Efeito |
| --- | --- | --- |
| `remove-member` | Nome do Canal privado; e-mail da Pessoa | Apaga a participação. Canal inexistente ou público, Pessoa sem conta ou que não é Membro, e o último Membro do Canal são recusados com mensagem: sem Membros, o Canal ficaria sem ninguém para adicionar Pessoas, com o nome preso |

A remoção não publica evento: a Pessoa para de receber as Mensagens na hora, porque a publicação lê
os Membros a cada envio, e o Canal some da barra lateral dela ao recarregar a página. O `create`
do comando continua criando só Canal público. A operação entra no `AGENTS.md` da API, seção
"Comandos", na tarefa que a implementa.

### Tempo real (API do chat e `packages/chat-events`)

| Evento | Direção | Carga |
| --- | --- | --- |
| `conversation.member_added` | API → aba | `event_id` (cursor, ausente se o Redis falhou), `conversation` (no formato da Conversa do REST, com `member_count`) e `person_ids`: só a própria Pessoa, para quem entrou agora, ou as Pessoas adicionadas, para quem já era Membro |

- **Para quem:** todos os Membros da Conversa depois da gravação, guardado no stream de cada um e
  emitido para a sala `person:`, como o `message.created` (spec da F03, "Eventos por Pessoa e
  reconexão").
  - Canal público criado: todas as Pessoas, cada uma com `person_ids` só com ela.
  - Canal privado criado: só quem o criou (as outras abas dela), com `person_ids` dela.
  - Adição ao Canal: os Membros novos, cada um com `person_ids` só com ele, e os antigos, com
    `person_ids` dos novos.
- **Carga por Pessoa:** a aba só precisa saber se ela mesma entrou agora. Com `person_ids` de todas
  as Pessoas, o Canal público novo gravaria o workspace inteiro em cada stream: com 4,5 mil Pessoas,
  o p95 da chegada passava de 3 s (medição da F04-T03).
- **Sem evento:** o reenvio idempotente da criação e a adição em que todas as Pessoas já eram
  Membros.
- Quem foi adicionada recebe as Mensagens seguintes sem nada a mais: a publicação lê os Membros a
  cada envio, e o `conversation.open` confere a participação na hora.

### BFF (web)

- **Server Actions:** `createChannel` (gera o `client_id` no cliente, uma vez por diálogo aberto,
  e o reenvia na nova tentativa) e `addMembers`. Validam a entrada como a API e devolvem a união
  discriminada da F01 (`ok`, `unauthenticated`, `not_found`, `failure`), com os casos `name_taken`
  e `invalid` na criação.
- **Rotas de leitura**, chamadas pelo cliente: `GET /api/conversations` (a lista, para o `reset`),
  `GET /api/conversations/:id/members` e `GET /api/people`, com os mesmos parâmetros da API.
- **401** em qualquer uma leva a `GET /api/session/expired`, como na F02.

### Cliente (web)

**Lista de Conversas no cliente**

- A lista do Server Component da barra lateral passa a ser o `fallbackData` de um `useSWR` de
  chave fixa, lido pela seção "Canais" e pelo cabeçalho da Conversa. O esqueleto e o erro da F02
  continuam no servidor.
- `conversation.member_added` com a Pessoa da aba em `person_ids`: insere a Conversa na lista pela
  ordem alfabética, sem nova requisição, e ignora um id que já está lá. Sem a Pessoa em
  `person_ids`: atualiza o `member_count` da Conversa na lista.
- Com `sync` de `reset`, a lista é buscada de novo por `GET /api/conversations`, junto com o
  histórico da Conversa aberta (spec da F03, "Cliente").
- O evento entra pelo provedor de tempo real da F03, com a mesma aplicação em ordem até o `sync`.
- Nada do que chega abre a Conversa nem muda o foco (PRD, história 4).

**Telas**, que reproduzem os frames do Figma (arquivo `slack`, página Telas):

- **Barra lateral:** a SidebarRow do Canal privado usa o ícone `Lock` no lugar do `Hash`, e a
  seção "Canais" ganha, no fim, a SidebarAction "Adicionar canal" (Casca / Sidebar / Com dados,
  25:20064), um componente cliente pequeno que abre o diálogo.
- **Diálogo "Criar canal"** ("Diálogos / Criar canal": Padrão 26:24488, Erro no nome 26:25296,
  Enviando 26:26110): Dialog do design system, com o campo do nome com o `#` fixo, o Tópico e o
  Switch "Tornar privado". O nome passa, a cada tecla, por uma função pura que espelha a da API:
  NFC, minúsculas, espaço vira `-`, os caracteres fora da regra não entram, e o texto é cortado no
  limite. O Tópico usa o mesmo limite da API, sem quebra de linha. `channel_name_taken` aparece no
  campo; outra falha, no diálogo, com o que foi preenchido.
- **Depois de criar:** o diálogo leva a `/conversas/<id>` pelo `router.push`. O Canal privado
  passa antes pelo passo "Adicionar pessoas"; fechar o diálogo nesse passo, por Esc, pelo X ou por
  "Pular", tem o mesmo efeito de pular. A Conversa abre como na F02, com o foco na caixa de
  mensagem.
- **Passo "Adicionar pessoas":** o mesmo componente na criação e na lista de Membros. A busca
  chama `GET /api/people` depois da `espera da busca de Pessoas` sem digitar (LLD, "Valores e
  configuração"), descartando a resposta de uma busca mais antiga. As escolhidas ficam numa lista
  acima dos resultados, e cada uma sai por um botão. Confirmar chama `addMembers`; na falha, o
  passo fica aberto com as escolhidas e o erro.
- **Cabeçalho do Canal** ("Conversa / Estrutura / Canal privado", 21:3570): o ícone segue o tipo, e
  o botão com a quantidade de Membros, lida da lista de Conversas no cliente, abre a lista de
  Membros.
- **Lista de Membros** ("Conversa / Sobreposições / Membros do canal", 23:17033): Dialog com
  PersonRow, lida de `GET /api/conversations/:id/members` ao abrir e lida de novo a cada
  `conversation.member_added` daquela Conversa enquanto está aberta. "(você)" ao lado da Pessoa da
  Sessão. No Canal privado, o botão "Adicionar pessoas" abre o passo de adicionar; no público, ele
  não aparece.
- **Mudança no Figma, antes do código de cada tela**, pelo `docs/design-system.md` ("Do código para
  o Figma"), cada uma na tarefa da tela que a usa:
  - criar os frames do passo "Adicionar pessoas" na criação e pela lista de Membros (com busca,
    escolhidas, sem resultado e enviando), seguindo o padrão de busca e PersonRow de "Diálogos /
    Nova conversa";
  - criar a falha ao criar o Canal e a falha ao adicionar;
  - pôr o botão "Adicionar pessoas" em "Membros do canal", numa variante de Canal privado;
  - trocar o rótulo "Descrição" do diálogo por "Tópico", o termo do glossário;
  - corrigir o nome no cabeçalho de "Conversa / Estrutura / Canal privado", que mostra `geral` no
    Canal `diretoria`.

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que aparece na tela), e não a forma interna dos services. A
forma de cada teste da API está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de ponta a ponta por HTTP com banco real:**

- criar Canal público inclui todas as Pessoas; privado, só quem criou; o reenvio com o mesmo
  `client_id` devolve o mesmo Canal sem gravar outro, mesmo com outro nome;
- nome repetido, inclusive o de um Canal privado de que a Pessoa não é Membro: 409; nome e Tópico
  inválidos: 400;
- adicionar: as Pessoas viram Membros; quem já era Membro fica fora de `added_person_ids`; id que
  não é de Pessoa: 400; quem não é Membro do Canal privado: 404; Canal público: 409;
- quem não é Membro de um Canal privado recebe 404 na Conversa, no histórico, no envio e nos
  Membros, e não o vê na lista;
- Membros em ordem alfabética, e a lista de Conversas com os privados juntos dos públicos;
- busca: sem acento acha o nome com acento; `%` e `_` como literais; sem os Membros de
  `not_member_of`; quem não é Membro de `not_member_of`: 404; o limite;
- sem Sessão, as rotas novas respondem 401.

**API do chat, testes de ponta a ponta com o servidor real e `socket.io-client`**, como os da F03:

- `conversation.member_added` do Canal público chega a todas as Pessoas conectadas; o do privado
  chega só às abas de quem criou; o da adição chega aos Membros antigos e novos, e não a quem não
  é Membro;
- o reenvio idempotente e a adição sem Pessoa nova não geram evento;
- o evento volta na reconexão com cursor;
- depois da adição, a Pessoa recebe o `message.created` do Canal e abre a Conversa no WebSocket.

**Comando, teste de integração:** `remove-member` apaga a participação, e recusa Canal público,
Canal inexistente e Pessoa que não é Membro.

**Unidade:** a ordem alfabética, na API e na web, com acentos e maiúsculas.

**Web, Vitest para as funções puras:** a normalização do nome enquanto se digita e a inserção da
Conversa na lista (ordem, id repetido, `member_count` atualizado).

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F04 junto dos testes. Duas Pessoas em dois contextos do navegador:

- uma cria um Canal público, que abre para ela e aparece na barra lateral da outra sem recarregar;
- o nome repetido mostra o erro no campo; o nome digitado com maiúsculas e espaços aparece
  normalizado;
- uma cria um Canal privado e adiciona a outra pela busca; o Canal aparece para a outra sem
  recarregar, com o cadeado, e as Mensagens chegam em tempo real;
- o Canal privado sem adicionar ninguém, pelo "Pular" e pelo Esc;
- quem não é Membro abre o endereço do Canal privado e vê "Conversa não encontrada";
- a lista de Membros com "(você)", e a quantidade que muda ao adicionar;
- a falha ao criar e ao adicionar, pelo `page.route`, sem perder o que foi preenchido;
- tudo pelo teclado, e a checagem de acessibilidade com `@axe-core/playwright` nos dois diálogos e
  na lista de Membros, sem violações.

Os testes que criam Canal público pela tela incluem todas as Pessoas do banco de desenvolvimento,
como os da F02: usam nomes `e2e-` únicos e conferem só os próprios Canais.

**Medição, registrada na pasta da tarefa do tempo real da F04** (`medicao-p95.md`): 50 sockets de
Pessoas diferentes, direto na API, e 50 Canais públicos criados por REST. Registra o p95 do tempo
entre a resposta da criação e a chegada do `conversation.member_added` em cada socket. O critério é
o do PRD, história 4: até 1 s no p95.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois
temas, comparada com o `get_screenshot` dos frames citados (`docs/design-system.md`, "Validação
visual"), registrada na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse com o diálogo "Criar canal", o passo "Adicionar pessoas" e a lista de Membros.

**Exemplos anteriores:** os testes da F02 e da F03, nas mesmas pastas e com as mesmas bases.

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- Evento de remoção de Membro: entra com a F17.
- Criar Canal privado pelo comando de canais.
- Paginação da lista de Membros: o público do brief são empresas pequenas e médias. Volta como
  pergunta se a lista de um Canal público ficar lenta.
- O snapshot OpenAPI das rotas novas, que segue planejado no LLD.

## Observações

- O glossário mudou: "Canal" passa a dizer que um Membro adiciona Pessoas ao Canal privado, e
  "Convite" fica reservado para a F15.
- O HLD diz "Canal privado visível e acessível só para quem foi convidado" (seção 1). A regra vale
  como está; só a palavra diverge do glossário.
- O registro no LLD está nas seções "Concorrência e idempotência", "Dados", "Interfaces",
  "Cliente" e "Valores e configuração".
- Os nós do Figma citados vieram do levantamento feito para esta spec e podem mudar de id se os
  frames forem recriados. Nesse caso, valem os nomes.
