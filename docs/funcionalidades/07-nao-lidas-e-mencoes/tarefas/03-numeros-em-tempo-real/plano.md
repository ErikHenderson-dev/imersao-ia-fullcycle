# Plano da F07-T03: Números em tempo real

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado um socket conectado de quem foi mencionado, quando a outra Pessoa envia a Mensagem
e depois reconecta-se com o cursor de antes, então o `conversation.unread` chega com
`conversation_id`, `last_read_message_id`, `unread_count`, `mention_count` e o `event_id`, e volta
na reconexão.

**Teste previsto:** e2e da API com `socket.io-client`, `test/realtime-unread.e2e-spec.ts`, "a
Mensagem enviada entrega os números a cada Membro" e "o evento volta na reconexão com cursor".

### CA2

**Marca:** teste HTTP

**Cenário:** Dado um Canal privado com a autora, um leitor e uma Pessoa de fora: enviar entrega o
evento ao leitor, com os números dele, e às abas da autora, com a Última leitura nova; não entrega
a quem não é Membro; a leitura que avança entrega o evento zerado às abas de quem leu e a ninguém
mais, e a que não avança não entrega nada; a edição que acrescenta uma Menção entrega só à Pessoa
mencionada, e a que não muda Menções não entrega nada; apagar entrega só a quem ainda não tinha
lido; o reenvio idempotente não entrega nada.

**Teste previsto:** `test/realtime-unread.e2e-spec.ts`, "a Mensagem enviada entrega os números a
cada Membro", "quem não é Membro não recebe", "a leitura entrega os números zerados só a quem leu",
"a leitura que não avança não entrega nada", "a edição que muda Menções entrega só a quem entrou ou
saiu", "apagar entrega só a quem ainda não tinha lido" e "o reenvio não entrega nada".

### CA3

**Marca:** teste HTTP

**Cenário:** Dadas várias Mensagens e uma leitura em sequência rápida, quando os eventos terminam de
chegar, então o último `conversation.unread` de cada Pessoa traz os mesmos números da lista de
Conversas.

**Teste previsto:** `test/realtime-unread.e2e-spec.ts`, "várias Mensagens e uma leitura terminam
com o último evento igual à lista".

### CA4

**Marca:** teste de unidade

**Cenário:** Dada a lista de Conversas, quando chega um `conversation.unread`, então os números da
Conversa são trocados; quando ele traz uma Última leitura anterior à do cache, é descartado.

**Teste previsto:** Vitest, `src/app/utils/conversation-list.test.ts`, "troca os números da
Conversa e descarta a resposta atrasada" (a mesma função aplica o evento e a resposta da leitura).

### CA5

**Marca:** teste HTTP

**Cenário:** O dos CA1 a CA3.

**Teste previsto:** os dos CA1 a CA3.

### CA6

**Marca:** teste no Playwright

**Cenário:** Duas Pessoas, uma com duas abas: a Menção sobe o contador da outra Pessoa sem
recarregar; abrir o Canal numa aba tira o negrito e o contador na outra aba; apagar a Mensagem com
a Menção zera o contador sem recarregar.

**Teste previsto:** Playwright, `e2e/nao-lidas/tempo-real.spec.ts`, "a Menção sobe o contador sem
recarregar", "ler numa aba tira o negrito na outra" e "apagar a Mensagem com a Menção zera o
contador".

## Contrato

### conversation.unread · servidor → cliente · novo

| Item | O que descreve |
| --- | --- |
| Quem recebe | A sala de cada Pessoa afetada, pela tabela da spec ("Tempo real", "Para quem") |
| Autenticação | A da conexão (Sessão no handshake, F03) |
| Carga | `conversation_id` (uuid), `last_read_message_id` (uuid ou nulo), `unread_count` e `mention_count` (inteiros de 0 a 100), todos obrigatórios; `event_id` opcional, o cursor da reconexão |
| Confirmação | Nenhuma |
| Erros | Nenhum: a falha na publicação vai para o log |

## Verificação do contrato

- A carga e o cursor: CA1; os destinatários: CA2; a ordem: CA3.

## Decisões

- Um `UnreadPublisher` no módulo de Mensagens calcula e publica: ele recebe a Conversa e as
  Pessoas, conta com o `UnreadCounter` da 01 e emite um evento por Pessoa pelo `RealtimePublisher`.
  Tudo passa por uma fila em memória por Conversa, e a contagem acontece dentro dela, na vez de
  cada publicação: o último evento que sai é o do estado mais novo do banco.
- O envio enfileira os números de todos os Membros depois do `message.created`, na mesma cadeia da
  publicação da Mensagem.
- A edição devolve as Pessoas que entraram ou saíram das Menções, comparando as Menções antes e
  depois da gravação; só elas recebem os números, depois do `message.updated`.
- A exclusão publica para os Membros, menos a autora, com a Última leitura nula ou anterior à
  Mensagem: uma consulta nova do service de Conversas os lista.
- A leitura publica só para quem leu, e só quando o `advanceLastRead` gravou (o booleano da 01).
- No cliente, o provedor de tempo real ganha o `onUnread`, e a lista de Conversas o aplica com o
  `applyUnread` da 02, que já descarta a Última leitura anterior.

## Arquivos e interfaces

- `packages/chat-events/index.d.ts`: `ConversationUnreadEvent` e a entrada em
  `StoredEventPayloads`.
- `apps/chat-api/src/realtime/realtime-socket.ts`: o nome no registro dos eventos guardados.
- `apps/chat-api/src/realtime/realtime.publisher.ts`: `conversationUnread(perPerson)`.
- `apps/chat-api/src/messages/unread.publisher.ts`: `UnreadPublisher.publish(conversationId,
  personIds)`.
- `apps/chat-api/src/conversations/conversations.service.ts`:
  `listMemberIdsReadBefore(conversationId, messageId, exceptId)`.
- `apps/chat-api/src/messages/messages.service.ts` e `read.service.ts`: as chamadas.
- `apps/web/src/app/components/realtime/realtime-provider.tsx`: `onUnread`.
- `apps/web/src/app/components/workspace-nav/conversation-list.tsx`: aplica o evento.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum: a spec da F07 e o LLD já descrevem o evento, os destinatários e a fila por Conversa.
