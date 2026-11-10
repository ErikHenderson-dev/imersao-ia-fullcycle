# Plano da F08-T01: Atividade ao carregar a página

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado um Canal em que a Pessoa é mencionada e uma Conversa direta em que ela recebe
Mensagens, quando ela pede `GET /v1/activity`, então recebe a Menção como `mention` e as Mensagens
diretas como `direct`, cada uma com a Mensagem e a Conversa, filtradas por `kind`, com keyset e
`has_more`; não recebe as próprias Mensagens, a Menção a si mesma, a Conversa direta consigo mesma,
as apagadas, a Menção dentro da Conversa direta como `mention`, nem as de um Canal privado de que
foi removida. Uma edição que acrescenta a Menção faz o item aparecer, e a que tira o faz sumir.

**Teste previsto:** e2e da API, `test/activity.e2e-spec.ts`, "lista as Notificações da Pessoa",
"filtra por tipo e pagina pelo id", "deixa fora o que não é Notificação" e "a edição que muda a
Menção muda a lista".

### CA2

**Marca:** teste HTTP

**Cenário:** Dadas Notificações antes e depois da Última leitura de cada Conversa, quando a Pessoa
pede `GET /v1/activity/unread`, então recebe só as posteriores, em `mention_count`,
`direct_count` e `total_count`, cada número parando em 100; depois de ler a Conversa, as dela saem
dos números.

**Teste previsto:** e2e da API, `test/activity.e2e-spec.ts`, "conta as Notificações não lidas",
"os números param no teto" e "ler a Conversa tira as Notificações dela dos números".

### CA3

**Marca:** teste no Playwright

**Cenário:** Dada uma Pessoa com Notificações, quando ela abre `/atividade` e rola, então a página
mostra a primeira página vinda do servidor e as anteriores pela rota do BFF; sem Sessão, a rota do
BFF leva a "Entrar".

**Teste previsto:** Playwright, `e2e/atividade/atividade.spec.ts`, "a Atividade lista as Menções e
as Mensagens diretas" e "rolar carrega as Notificações mais antigas".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dadas Notificações não lidas, quando a Pessoa está em qualquer tela logada, então o
rail mostra o link Atividade abaixo do Início, com o CountBadge do total e o nome acessível
"Atividade, N não lidas"; em `/atividade` o link está ativo e o Início não; sem não lidas, o nome é
só "Atividade".

**Teste previsto:** Playwright, `e2e/atividade/atividade.spec.ts`, "o rail mostra Atividade com o
número de não lidas"; Vitest, `src/app/utils/activity.test.ts`, "o nome acessível do link Atividade".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dada a tela Atividade, quando a Pessoa escolhe Menções ou Mensagens diretas, então a
URL leva `?aba=mencoes` ou `?aba=diretas`, a lista mostra só aquele tipo e cada aba mostra o seu
contador; não há aba Tarefas.

**Teste previsto:** Playwright, `e2e/atividade/atividade.spec.ts`, "as abas filtram por tipo e
mostram os contadores".

### CA6

**Marca:** teste de unidade

**Cenário:** Dado um item, quando ele é exibido, então o título é "Rafael Trevisani mencionou você
em #geral" ou "Regina Fonseca enviou uma mensagem direta", o tempo relativo segue "agora", "há 5
min", "há 2 h" e a data a partir de um dia, o item é não lido quando a Mensagem é posterior à Última
leitura da Conversa, e o nome acessível junta título, começo do texto, tempo e "não lida".

**Teste previsto:** Vitest, `src/app/utils/activity.test.ts`, "o título do item", "o tempo
relativo", "lida pela Última leitura" e "o nome acessível do item"; Playwright, o do CA3, que abre a
Conversa pelo item com Enter.

### CA7

**Marca:** teste no Playwright

**Cenário:** Dada uma Pessoa sem Notificações, quando ela abre cada aba, então vê o vazio da aba;
com a rota da API falhando, vê o erro com "Tentar de novo"; enquanto a página carrega, o esqueleto.

**Teste previsto:** Playwright, `e2e/atividade/atividade.spec.ts`, "cada aba vazia mostra o seu
vazio" e "a falha mostra o erro com Tentar de novo" (a falha forçada pela interceptação da rota do
BFF na página seguinte e, no RSC, pela verificação visual do frame).

### CA8

**Marca:** teste no Playwright

**Cenário:** Dada a tela Atividade com itens lidos e não lidos, quando a Pessoa navega só pelo
teclado, então chega às abas e aos itens e abre a Conversa com Enter; o marcador do Início da F07
aparece na tela Atividade; o axe não acha violações.

**Teste previsto:** Playwright, `e2e/atividade/atividade.spec.ts`, "tudo pelo teclado" e
"acessibilidade da tela Atividade", e o marcador no "o rail mostra Atividade com o número de não
lidas".

### CA9

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md` e `roteiro-manual.md`, nesta pasta, e encontra
as capturas da tela Atividade (itens, vazios, erro, carregando) e do rail com Atividade ativa, nos
dois temas, ao lado dos frames, e a nota 100 do Lighthouse na tela Atividade.

## Contrato

### GET /v1/activity · nova

| Item | O que descreve |
| --- | --- |
| Autenticação | Cookie de sessão, pelo guard da F01 |
| Parâmetros de consulta | `kind`: `all`, `mentions` ou `direct`, opcional, padrão `all`; `before`: uuid, opcional; `limit`: inteiro de 1 ao "Tamanho da página" máximo, padrão o do LLD |
| Corpo da requisição | Nenhum |
| Resposta de sucesso | 200 com `items` (em ordem cronológica) e `has_more`. Cada item: `kind` (`mention` ou `direct`), `message` (a Mensagem como no REST do histórico) e `conversation` (a Conversa como no evento `conversation.member_added`: `id`, `kind`, `name`, `topic`, `member_count`, `counterpart`) |
| Erros | 400 `validation_failed`; 401 `unauthenticated` |

### GET /v1/activity/unread · nova

| Item | O que descreve |
| --- | --- |
| Autenticação | Cookie de sessão |
| Resposta de sucesso | 200 com `total_count`, `mention_count` e `direct_count`, inteiros de 0 a 100 |
| Erros | 401 `unauthenticated` |

A `activity_read_message_id` da spec entra com a marca, na F08-T04.

### GET /api/activity · nova (BFF)

| Item | O que descreve |
| --- | --- |
| Rota da API | `GET /v1/activity`, com o cookie de sessão repassado |
| Parâmetros de consulta | `kind` e `before`, repassados |
| Resposta de sucesso | 200 com `items` (com os campos da web, em camelCase, como a página do histórico) e `hasMore` |
| Erros | 401 e 400 como a API; o resto como 502 |

## Verificação do contrato

- `GET /v1/activity` 200, com `kind`, keyset e `has_more`: CA1. 400 com `kind` inválido e 401 sem
  Sessão: CA1 (casos de erro no mesmo arquivo).
- `GET /v1/activity/unread` 200 e o teto: CA2. 401: CA2.
- `GET /api/activity` 200: CA3; 401 levando a "Entrar": CA3.

## Decisões

- Um módulo novo da API, `activity`, com o controller, o service e o `NotificationFinder`, a
  função única de Notificações da spec (a lista e a contagem em lote), em SQL, como o
  `UnreadCounter` da F07. Ele cruza as tabelas de Mensagens, Menções e participações, como o
  `UnreadCounter` já faz, porque o módulo de Mensagens não pode depender de quem depende dele.
- A Mensagem do item sai do `MessagesService`, que passa a expor a montagem por ids (a mesma de uma
  página do histórico), e a Conversa, do `ConversationsService` (as Conversas por ids, com o número
  de Membros), para o item ser igual ao REST e ao evento sem uma segunda montagem.
- A Conversa do item vai inteira, como no evento, e não só os quatro campos da spec: é o tipo que
  a web já sabe ler, e nada nela é sensível.
- A lista lê, das duas fontes, só as `limit + 1` mais novas antes de `before`, e junta as duas em
  ordem de id.
- No cliente, os números de Atividade ficam num SWR com a chave da Pessoa, preenchido pelo RSC do
  rail; a 03 o atualiza pelo tempo real.
- O link Atividade e os itens são links (`<a>`), e não botões: eles navegam, e Enter os abre, como
  o PRD pede. As abas são links com `aria-current`, porque cada uma é uma URL.
- O estado de lido sai do cache da lista de Conversas (a Última leitura de cada uma), lido com o
  mesmo hook do título e do marcador da F07.
- O botão "Marcar tudo como lido" dos frames entra na 04; aqui o cabeçalho fica só com o título.
- O tempo relativo é uma função pura sobre a hora atual, sem atualizar sozinho enquanto a tela está
  aberta: recarregar ou chegar uma Notificação (03) o refaz.

## Arquivos e interfaces

- `apps/chat-api/src/activity/activity.module.ts`, `activity.controller.ts`, `activity.service.ts`,
  `notification-finder.ts`, `list-activity.query.ts`, `activity.response.ts`: o módulo novo.
- `apps/chat-api/src/messages/messages.service.ts`: `viewsByIds(ids)`; `messages.module.ts` exporta
  o service.
- `apps/chat-api/src/conversations/conversations.service.ts`: `summariesByIds(ids)`.
- `apps/chat-api/src/app.module.ts`: importa o `ActivityModule`.
- `apps/web/src/app/services/chat-api.ts`: `listActivity`, `getActivityUnread`, os tipos
  `ActivityItem`, `ActivityKind`, `ActivityTab`, `ActivityUnread`.
- `apps/web/src/app/api/activity/route.ts`: a rota do BFF.
- `apps/web/src/app/(app)/atividade/page.tsx` e `loading.tsx`: a tela.
- `apps/web/src/app/components/notification/notification-item.tsx`, `activity-list.tsx`,
  `activity-tabs.tsx`: o item, a lista com o `useSWRInfinite` e as abas.
- `apps/web/src/app/components/workspace-nav/activity-link.tsx` e `rail.tsx`; `home-link.tsx`
  deixa de ficar ativo em `/atividade`.
- `apps/web/src/app/utils/activity.ts`: título, tempo relativo, lida, nomes acessíveis, aba da URL.
- `apps/web/e2e/atividade/atividade.spec.ts` e `apps/web/e2e/plano-de-testes-f08.md`.

## Testes existentes que mudam

- O teste do marcador do Início da F07 continua; o caso "a tela Atividade ainda não existe" passa a
  ser provado na própria tela, no CA8.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum: a spec e o LLD já descrevem as rotas e a tela como `planejadas`.
