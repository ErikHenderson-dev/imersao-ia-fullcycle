# Plano da F08-T04: Marcar tudo como lido

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de integração

**Cenário:** Dado o banco migrado, quando o teste lê a coluna nova de `people`, então ela existe,
aceita nulo e as Pessoas criadas antes dela ficam com nulo.

**Teste previsto:** e2e da API, `test/database.e2e-spec.ts`, "people tem a marca de Atividade,
nula por padrão".

### CA2

**Marca:** teste HTTP

**Cenário:** Dadas Notificações antes e depois da marca, quando a Pessoa pede os números, então só
as posteriores ao maior entre a Última leitura da Conversa e a marca contam.

**Teste previsto:** e2e da API, `test/activity.e2e-spec.ts`, "a marca tira dos números as
Notificações até ela".

### CA3

**Marca:** teste HTTP

**Cenário:** Dada uma Pessoa com Notificações, quando ela pede `PUT /v1/activity/read` com o id da
mais nova, então recebe 200 com os números zerados e a marca, e a Última leitura das Conversas e os
números da lista de Conversas não mudam; uma posição igual ou anterior responde 200 sem mudar nada;
uma Mensagem que não existe ou é de uma Conversa de que ela não é Membro responde 404
`message_not_found`; um corpo inválido, 400; sem Sessão, 401.

**Teste previsto:** e2e da API, `test/activity.e2e-spec.ts`, "marcar tudo zera os números sem mexer
nas Conversas", "uma marca igual ou anterior não muda nada", "a Mensagem de fora responde 404", "o
corpo inválido responde 400" e "marcar tudo responde 401 sem Sessão".

### CA4

**Marca:** teste HTTP

**Cenário:** Dada a marca que avançou, quando a API publica, então todas as abas da Pessoa recebem
`activity.unread` com os números zerados e a marca; a que não avançou não publica.

**Teste previsto:** e2e da API com `socket.io-client`, `test/realtime-activity.e2e-spec.ts`, "a
marca que avança entrega a todas as abas" e "a marca que não avança não entrega nada".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dada a tela Atividade, quando não há não lidas, então o botão "Marcar tudo como lido"
fica desabilitado; com não lidas, ele fica habilitado e, enquanto espera a resposta, mostra o estado
"Marcando tudo"; na falha da rota, aparece o toast "Não foi possível marcar como lido".

**Teste previsto:** Playwright, `e2e/atividade/marcar-tudo.spec.ts`, "o botão fica desabilitado sem
não lidas" e "a falha mostra o toast de erro".

### CA6

**Marca:** teste no Playwright

**Cenário:** Duas abas da Pessoa, com Notificações não lidas e a Conversa delas com o negrito na
barra lateral: marcar tudo numa aba zera o rail nas duas e deixa os itens lidos, e a barra lateral
continua com o negrito.

**Teste previsto:** Playwright, `e2e/atividade/marcar-tudo.spec.ts`, "marcar tudo zera o rail nas
duas abas e mantém o negrito da barra lateral".

## Contrato

### people · chat · alterada

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `activity_read_message_id` | uuid | sim | nulo | A marca de Atividade (spec da F08, "Notificações e contagem") |

- Chave estrangeira para `messages(id)`, sem ação de exclusão (`NO ACTION`): a exclusão de Mensagem
  é lógica.

### PUT /v1/activity/read · nova

| Item | O que descreve |
| --- | --- |
| Autenticação | Cookie de sessão |
| Corpo da requisição | `message_id`: uuid, obrigatório |
| Resposta de sucesso | 200 com `activity_read_message_id`, `total_count`, `mention_count`, `direct_count` |
| Erros | 400 `validation_failed`; 401 `unauthenticated`; 404 `message_not_found` |

### GET /v1/activity/unread · alterada

- Antes: `total_count`, `mention_count`, `direct_count`.
- Depois: os mesmos, mais `activity_read_message_id` (uuid ou nulo).

### activity.unread · servidor → cliente · alterado

- Antes: `event_id`, `total_count`, `mention_count`, `direct_count`.
- Depois: os mesmos, mais `activity_read_message_id` (uuid ou nulo).

### PUT /api/activity/read · nova (BFF)

| Item | O que descreve |
| --- | --- |
| Rota da API | `PUT /v1/activity/read`, com o cookie repassado e `messageId` como `message_id` |
| Corpo da requisição | `messageId`: texto, obrigatório |
| Resposta de sucesso | 200 com `activityReadMessageId`, `totalCount`, `mentionCount`, `directCount` |
| Erros | 401, 404 e 400 como a API; o resto como 502 |

## Verificação do contrato

- `people.activity_read_message_id`: CA1.
- `PUT /v1/activity/read` 200, 400, 401 e 404: CA3.
- `GET /v1/activity/unread` com a marca: CA2.
- `activity.unread` com a marca: CA4.
- `PUT /api/activity/read`: CA5 e CA6 (sucesso e falha pela tela).

## Decisões

- A marca é uma relação da entidade `Person` com `Message`, como a Última leitura na participação,
  para a migração gerada manter a chave estrangeira.
- A contagem passa a comparar com o maior entre a Última leitura e a marca, numa junção com `people`
  na mesma consulta.
- A gravação é condicional (`IS NULL OR < :novo`), como a da Última leitura; a resposta conta de novo
  depois de gravar.
- No cliente, a marca vai nos números de Atividade (`activityReadMessageId`), e o item é lido quando a
  Mensagem é igual ou anterior ao maior entre a Última leitura da Conversa e a marca.
- O botão manda o id da Notificação mais nova de Todas: a do cache da aba, ou, em outra aba, a da
  primeira página de Todas, buscada pela rota do BFF na hora do clique.

## Arquivos e interfaces

- `apps/chat-api/migrations/<instante>-AddPersonActivityRead.ts`: a coluna e a chave estrangeira.
- `apps/chat-api/src/people/person.entity.ts`: `activityReadMessageId`.
- `apps/chat-api/src/notifications/notification-finder.ts`: a marca na contagem;
  `ActivityCounts.activityReadMessageId`.
- `apps/chat-api/src/activity/`: `PUT /v1/activity/read`, `read-activity.dto.ts`, o service e a
  resposta.
- `packages/chat-events/index.d.ts`: o campo novo de `ActivityUnreadEvent`.
- `apps/web/src/app/services/chat-api.ts`, `api/activity/read/route.ts`, o tipo `ActivityUnread`.
- `apps/web/src/app/components/notification/mark-all-read-button.tsx` e `activity-header.tsx`.
- `apps/web/src/app/utils/activity.ts`: `isNotificationRead` com a marca.
- `apps/web/e2e/atividade/marcar-tudo.spec.ts`.

## Testes existentes que mudam

- Os testes da F08-T01 e da F08-T03 que comparam o corpo de `GET /v1/activity/unread` e do
  `activity.unread` com `toEqual` passam a esperar `activity_read_message_id`.

## Mudança de dados

Nenhuma: a coluna nasce nula.

## Documentos atualizados

Nenhum: a spec e o LLD já descrevem a coluna, a rota e a marca como `planejadas`.
