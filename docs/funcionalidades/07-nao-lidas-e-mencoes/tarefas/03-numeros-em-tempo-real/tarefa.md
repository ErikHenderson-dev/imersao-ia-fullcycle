# 03: Números em tempo real

**Status:** em andamento

**O que construir:** o negrito e os contadores da barra lateral mudam na hora, em todas as abas e
navegadores de cada Membro afetado, sem recarregar: uma Mensagem nova, uma edição que muda Menção,
uma exclusão e a leitura numa aba chegam como o evento `conversation.unread`, com os números
calculados pelo servidor. Uma aba atrasada não volta os números para trás, e o que chegou durante
uma queda de conexão conta ao reconectar. Referências:
- spec da F07, "Tempo real" e "Cliente" ("Lista de Conversas e barra lateral");
- spec da F03, "Eventos por Pessoa e reconexão"; spec da F06, "Tempo real" (fila por Mensagem);
- LLD, "Concorrência e idempotência" ("Última leitura") e "Interfaces" (WebSocket);
- PRD, história 5.

**Decisões consumidas de outras tarefas:**
- Os campos da lista de Conversas e a função de contagem: 01.
- A rota de leitura e a regra de exibição da Conversa aberta em foco: 02.

**Bloqueada por:** 01 (Números na barra lateral), 02 (Ler a Conversa)

- [ ] **CA1** · O `conversation.unread` (`conversation_id`, `last_read_message_id`,
  `unread_count`, `mention_count`) entra no `chat-events` como evento guardado, reenviado na
  reconexão.
- [ ] **CA2** · Quem recebe segue a tabela da spec: o envio, a todos os Membros, inclusive o
  autor; a edição que muda Menções, só às Pessoas que entraram ou saíram; a exclusão, só a quem
  ainda não tinha lido; a leitura que avançou, só à própria Pessoa. A edição sem mudança de Menção,
  a leitura que não avançou e o reenvio idempotente não publicam.
- [ ] **CA3** · Os números são calculados na hora de publicar, numa fila em memória por Conversa,
  depois dos eventos de Mensagem da mesma mudança; a falha na publicação só vai para o log.
- [ ] **CA4** · O cliente troca os números da Conversa pelo id ao receber o evento e descarta o que
  traz Última leitura anterior à do cache, numa função pura com teste.
- [ ] **CA5** · Os testes com `socket.io-client` provam os destinatários de cada caso, a ausência
  de evento para quem não é Membro, o reenvio na reconexão com cursor e que várias Mensagens e uma
  leitura em sequência rápida terminam com o último evento igual à lista.
- [ ] **CA6** · O Playwright prova, com duas Pessoas e uma delas com duas abas: a Menção sobe o
  contador sem recarregar; abrir o Canal tira o negrito e o contador nas duas abas; apagar a
  Mensagem com a Menção zera o contador na outra Pessoa.
