# 03: Atividade em tempo real

**Status:** a fazer

**O que construir:** o número do rail, os contadores das abas, os itens de Atividade e o estado de
lido mudam na hora, em todas as abas e navegadores da Pessoa, sem recarregar: uma Notificação nova
entra no topo, uma Mensagem apagada sai, uma Menção acrescentada ou tirada na edição entra ou sai,
e ler a Conversa deixa as Notificações dela lidas. Os números chegam no evento `activity.unread`,
calculados pelo servidor numa fila por Pessoa. Esta tarefa decide a forma do `activity.unread`,
que a 04 consome, e a função pura "esta Mensagem é uma Notificação para mim?", que a 05 e a 06
reaproveitam. Referências:
- spec da F08, "Tempo real" e "Cliente" ("Números de Atividade" e "Tela Atividade");
- spec da F07, "Tempo real" (fila por Conversa); spec da F03, "Eventos por Pessoa e reconexão";
- LLD, "Concorrência e idempotência" ("Notificações") e "Interfaces" (WebSocket);
- PRD, histórias 4 e 5.

**Decisões consumidas de outras tarefas:**
- A função de Notificações, o contrato das rotas e os tipos da web: 01.
- O formato do link para a Mensagem: 02 (fixado na spec).

**Bloqueada por:** 01 (Atividade ao carregar a página)

- [ ] **CA1** · O `activity.unread` entra no pacote de eventos, guardado por Pessoa e reenviado na
  reconexão.
- [ ] **CA2** · Ele chega a quem a spec manda: na Mensagem enviada, ao autor, às Pessoas
  mencionadas num Canal e à outra Pessoa de uma Conversa direta; na edição que muda Menção, só às
  Pessoas que entraram ou saíram; na exclusão, só a quem não tinha lido; na leitura, a todas as
  abas da própria Pessoa. O que não muda nada não publica.
- [ ] **CA3** · Uma fila por Pessoa calcula os números na hora de publicar e junta as publicações
  que esperam; Mensagens em várias Conversas em sequência rápida terminam, no último evento
  recebido, com os números iguais aos da rota.
- [ ] **CA4** · A função pura que diz se uma Mensagem é Notificação para a Pessoa, e as que
  aplicam `message.created`, `message.updated` e `message.deleted` ao cache das abas de Atividade,
  têm testes.
- [ ] **CA5** · O estado de lido acompanha a Última leitura da lista de Conversas, sem recarregar.
- [ ] **CA6** · Na reconexão com `reset`, os números são buscados de novo e ficam iguais aos de
  uma página recarregada.
- [ ] **CA7** · O Playwright prova, entre duas Pessoas e duas abas, a Notificação entrando em
  Atividade e no rail, a exclusão tirando o item e ler a Conversa baixando o número nas duas abas,
  sem recarregar.
