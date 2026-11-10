# Plano da F08-T03: Atividade em tempo real

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de integração

**Cenário:** Dado o pacote de eventos, quando a API publica `activity.unread` e a Pessoa reconecta
com um cursor anterior a ele, então o evento volta no reenvio, como os outros eventos guardados.

**Teste previsto:** e2e da API com `socket.io-client`, `test/realtime-activity.e2e-spec.ts`, "o
evento volta na reconexão com cursor".

### CA2

**Marca:** teste HTTP

**Cenário:** Dada uma Mensagem enviada, editada, apagada ou lida, quando a API publica, então o
`activity.unread` chega a quem a spec manda: na Menção num Canal, à Pessoa mencionada e ao autor, e
não a outro Membro; na Mensagem numa Conversa direta, à outra Pessoa e ao autor; na edição que muda
Menção, só a quem entrou ou saiu; na exclusão, só a quem não tinha lido; na leitura, a todas as abas
de quem leu. O que não muda nada (leitura que não avança) não publica.

**Teste previsto:** e2e da API com `socket.io-client`, `test/realtime-activity.e2e-spec.ts`, "a
Menção num Canal entrega à Pessoa mencionada e ao autor", "a Mensagem direta entrega à outra Pessoa
e ao autor", "a edição que muda Menção entrega só a quem entrou ou saiu", "a exclusão entrega só a
quem não tinha lido", "a leitura entrega a todas as abas de quem leu" e "a leitura que não avança
não entrega nada".

### CA3

**Marca:** teste HTTP

**Cenário:** Dadas Mensagens em várias Conversas e uma leitura em sequência rápida, quando os
eventos chegam, então o último `activity.unread` recebido tem os números iguais aos de
`GET /v1/activity/unread`.

**Teste previsto:** e2e da API com `socket.io-client`, `test/realtime-activity.e2e-spec.ts`,
"mudanças em sequência terminam com os números da rota".

### CA4

**Marca:** teste de unidade

**Cenário:** Dada uma Mensagem, a Conversa dela e a Pessoa, quando o cliente decide se é
Notificação, então é Menção num Canal que menciona a Pessoa, Mensagem direta de outro autor numa
Conversa direta, e nada nos outros casos; e as funções que aplicam `message.created`,
`message.updated` e `message.deleted` ao cache das abas põem, trocam, tiram ou deixam como está o
item certo.

**Teste previsto:** Vitest, `src/app/utils/activity-cache.test.ts`, "a Mensagem é Notificação para
a Pessoa", "a nova entra no topo da aba do tipo dela", "a edição troca o texto, põe ou tira pela
Menção" e "a apagada sai".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dada a tela Atividade aberta, quando a Conversa de uma Notificação é lida em outra aba,
então o item passa a lido sem recarregar.

**Teste previsto:** Playwright, `e2e/atividade/tempo-real.spec.ts`, "ler a Conversa deixa o item
lido e baixa o número nas duas abas".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dada uma aba sem rede, quando chega uma Menção e a rede volta, então o número do rail
fica igual ao de uma página recarregada, pelo reenvio na reconexão; no `reset`, o link busca os
números de novo pela rota do BFF (o mesmo caminho da lista de Conversas da F07).

**Teste previsto:** Playwright, `e2e/atividade/tempo-real.spec.ts`, "a queda de conexão termina
com os números certos".

### CA7

**Marca:** teste no Playwright

**Cenário:** Duas Pessoas, uma com duas abas: uma Menção e uma Mensagem direta entram em Atividade e
no rail das duas abas; a exclusão tira o item; ler a Conversa baixa o número nas duas abas, sem
recarregar.

**Teste previsto:** Playwright, `e2e/atividade/tempo-real.spec.ts`, "a Notificação entra na
Atividade e no rail das duas abas", "a Mensagem apagada sai da Atividade" e "ler a Conversa deixa o
item lido e baixa o número nas duas abas".

## Contrato

### activity.unread · servidor → cliente · novo

| Item | O que descreve |
| --- | --- |
| Quem recebe | A sala da Pessoa (todas as abas e navegadores dela), conforme a tabela da spec ("Tempo real") |
| Autenticação | A da conexão do WebSocket (cookie de sessão) |
| Carga | `event_id` (cursor, opcional, ausente com o Redis fora), `total_count`, `mention_count`, `direct_count` (inteiros de 0 a 100) |
| Confirmação | Nenhuma |
| Erros | Nenhum: a falha da publicação só vai para o log |

Guardado por Pessoa e reenviado na reconexão: entra em `StoredEventPayloads`. A
`activity_read_message_id` da spec entra com a marca, na F08-T04.

### GET /api/activity/unread · nova (BFF)

| Item | O que descreve |
| --- | --- |
| Rota da API | `GET /v1/activity/unread`, com o cookie repassado |
| Resposta de sucesso | 200 com `totalCount`, `mentionCount` e `directCount` |
| Erros | 401 como a API; o resto como 502 |

## Verificação do contrato

- `activity.unread`, quem recebe: CA2; a carga e a ordem: CA2 e CA3; o reenvio: CA1.
- `GET /api/activity/unread` 200: CA6; 401: o tratamento comum do cliente, como a lista de
  Conversas na reconexão (um 401 aqui é só uma falha, e quem leva a "Entrar" é o `session.ended`).

## Decisões

- Um módulo novo da API, `notifications`, com o `NotificationFinder` (que sai do módulo de
  Atividade) e o `ActivityPublisher`: o módulo de Mensagens publica por ele, e o de Atividade lê por
  ele, sem ciclo entre Mensagens e Atividade.
- O `ActivityPublisher` tem uma fila em memória por Pessoa, que conta na vez da publicação e junta
  as que esperam, como o `UnreadPublisher` da F07 faz por Conversa.
- Quem recebe, no envio: o autor, as Pessoas mencionadas, se a Conversa é um Canal, e os Membros, se
  é uma Conversa direta. Na edição, as Pessoas que entraram ou saíram das Menções. Na exclusão, das
  Pessoas que ainda não tinham lido, as mencionadas num Canal ou a outra Pessoa da Conversa direta.
  Na leitura que avançou, quem leu.
- No cliente, o provedor de tempo real repassa o `activity.unread` a quem assina (`onActivityUnread`);
  o link do rail, sempre montado, grava os números no cache e, no `reset`, busca de novo.
- A tela Atividade aplica `message.created`, `message.updated` e `message.deleted` ao cache das
  páginas por funções puras; a decisão "é Notificação para mim" sai de uma função que a 05 e a 06
  reaproveitam. A Conversa do item vem da lista de Conversas no cache. No `reset`, a lista revalida.

## Arquivos e interfaces

- `packages/chat-events/index.d.ts`: `ActivityUnreadEvent` e a entrada em `StoredEventPayloads`.
- `apps/chat-api/src/notifications/`: `notifications.module.ts`, `notification-finder.ts` (movido),
  `activity.publisher.ts`.
- `apps/chat-api/src/realtime/realtime.publisher.ts` e `realtime-socket.ts`: `activityUnread`.
- `apps/chat-api/src/messages/messages.service.ts`, `read.service.ts`, `messages.module.ts`: as
  publicações.
- `apps/chat-api/src/activity/`: passa a importar o módulo de Notificações.
- `apps/web/src/app/components/realtime/realtime-provider.tsx`: `onActivityUnread`.
- `apps/web/src/app/api/activity/unread/route.ts` e `services/activity-pages.ts`: a busca dos números.
- `apps/web/src/app/utils/activity-cache.ts`: `notificationKindFor`, `applyCreated`, `applyUpdated`,
  `applyDeleted`.
- `apps/web/src/app/components/workspace-nav/activity-link.tsx` e
  `components/notification/activity-list.tsx`: as assinaturas.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum: a spec e o LLD já descrevem o evento e a fila por Pessoa como `planejados`.
