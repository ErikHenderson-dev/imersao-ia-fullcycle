# 01: Eventos de Mensagem genéricos no tempo real

**Status:** em andamento

**O que construir:** refatoração prévia, sem mudança de comportamento. O publisher, o reenvio na
reconexão do gateway e o provedor de tempo real da web deixam de supor que todo evento guardado de
Mensagem é `message.created`, e passam a aceitar qualquer evento do mapa de eventos guardados do
`chat-events`. Assim, a 03 e a 04 acrescentam `message.updated` e `message.deleted` só declarando o
evento e o tratamento dele, sem decidir de novo como o tempo real lida com mais de um tipo.
Referências:
- spec da F06, "Tempo real" ("Contrato") e "Cliente" ("Eventos no cliente");
- spec da F03, "Eventos por Pessoa e reconexão";
- LLD, "Interfaces" (WebSocket).

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · A emissão do publisher e o reenvio do gateway usam o nome do evento guardado, sem
  conversão fixa para `message.created`, com tipagem que só aceita nomes do mapa de eventos
  guardados.
- [ ] **CA2** · No provedor da web, a aplicação de um evento guardado é escolhida pelo nome, de
  modo que um evento novo entre como mais um caso, com o mesmo buffer e a mesma ordem da
  sincronização.
- [ ] **CA3** · Os testes atuais de tempo real da API (mensagens, recuperação, Membros) e da web
  continuam passando sem mudança de expectativa, e a verificação completa dos dois projetos passa.
