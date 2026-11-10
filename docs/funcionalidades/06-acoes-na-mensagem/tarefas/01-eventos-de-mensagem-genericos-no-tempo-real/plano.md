# Plano da F06-T01: Eventos de Mensagem genéricos no tempo real

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Dado o mapa de eventos guardados do `chat-events`, quando o publisher emite um evento
guardado ou o gateway o reenvia na reconexão, então o nome emitido é o do evento guardado, e a
lista de nomes reenviados é derivada de um registro que o compilador obriga a ter uma entrada por
evento do mapa. Um nome que não está no mapa não compila, e o reenvio de um nome desconhecido (de
outra versão) continua ignorado.

**Teste previsto:** o `pnpm exec tsc --noEmit` da API prova a tipagem; o comportamento é provado
pelos e2e de tempo real que já existem (CA3), que passam sem mudança. Nenhum teste novo: a
refatoração não muda o que sai no socket.

### CA2

**Marca:** revisão humana

**Cenário:** Dado o provedor de tempo real da web, quando chega um evento guardado, então ele é
guardado até o sync e aplicado pelo tratamento registrado para o nome dele, numa tabela com uma
entrada por evento do mapa, que o compilador exige completa. A ordem e o buffer até o sync não
mudam.

**Teste previsto:** o `pnpm exec tsc --noEmit` da web prova a tabela completa; o Vitest de
`event-cursor.test.ts` (ordem até o sync) e os Playwright de tempo real (CA3) provam que o
comportamento não mudou.

### CA3

**Marca:** teste de integração

**Cenário:** Dado o código refatorado, quando a verificação completa da API e da web roda, então
todos os testes de tempo real (mensagens, recuperação, Membros, Conversa direta) passam sem mudança
de expectativa.

**Teste previsto:** a verificação completa dos dois projetos (`AGENTS.md` de cada um), com destaque
para `test/realtime-messages.e2e-spec.ts`, `test/realtime-recovery.e2e-spec.ts`,
`test/realtime-conversations.e2e-spec.ts` e os specs de `e2e/tempo-real/` da web.

## Contrato

O contrato não muda.

## Verificação do contrato

Nenhuma: nenhum item de contrato nasce ou muda.

## Decisões

- O nome dos eventos guardados que a reconexão reenvia sai de um registro tipado como
  `Record<keyof StoredEventPayloads, true>`, para um evento novo no `chat-events` virar erro de
  compilação até entrar na lista, em vez de ser ignorado na reconexão sem aviso.
- A emissão de um evento guardado fica numa função só da API, tipada pelo par nome e carga de
  `StoredEventPayloads`, usada pelo publisher e pelo gateway; o cast que o Socket.IO exige para um
  nome genérico fica só nela.
- Na web, o tipo `StoredEvent` passa a ser derivado do mapa de eventos guardados, e a aplicação vira
  uma tabela de tratamentos por nome (`satisfies` um registro completo), registrada no socket num
  laço sobre os nomes. Um evento novo é uma entrada a mais na tabela e um callback a mais em
  `RealtimeListener`.
- `RealtimeListener` não muda nesta tarefa: os callbacks de edição e exclusão entram na 03 e na 04,
  com os eventos.

## Arquivos e interfaces

- `apps/chat-api/src/realtime/realtime-socket.ts`: `emitStoredEvent(target, name, event)`, a emissão
  tipada de um evento guardado para um `BroadcastOperator` ou um socket.
- `apps/chat-api/src/realtime/realtime.publisher.ts`: o `emit` privado passa a usar
  `emitStoredEvent`.
- `apps/chat-api/src/realtime/realtime.gateway.ts`: `STORED_EVENT_NAMES` derivado do registro
  tipado; o reenvio usa `emitStoredEvent`.
- `apps/web/src/app/components/realtime/realtime-provider.tsx`: `StoredEvent` derivado do mapa;
  tabela de tratamentos por nome; registro dos listeners num laço.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum: a spec da F06 ("Tempo real", "Contrato") já descreve a mudança, e o LLD não registra a
forma interna do publisher.
