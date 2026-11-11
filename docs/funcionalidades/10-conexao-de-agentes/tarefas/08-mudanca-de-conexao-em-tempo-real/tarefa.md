# 08: Mudança de conexão em tempo real

**Status:** concluída

**O que construir:** quando um administrador conecta ou desconecta um Agente, todas as Pessoas
veem a mudança sem recarregar, em todas as abas: na barra lateral, no diálogo "Agentes" aberto e em
tudo o que lê a lista de Agentes. Uma aba que perdeu o evento acerta na próxima conexão do socket.
Esta tarefa decide a rota `POST /v1/agents/changed`, o evento `agents.changed` e onde as duas
Server Actions o chamam. Referências:
- spec da F10, "Evento `agents.changed`", "BFF" (passo 4 das Server Actions) e "Cliente" ("Lista de
  Agentes no cliente");
- spec da F09, "Tempo real" (sala `workspace`, eventos sem cursor nem reenvio);
- PRD, "Critérios de aceite", "Todas as histórias" (1 s no p95).

**Decisões consumidas de outras tarefas:**
- `is_admin` na Pessoa da Sessão: 02.
- Cache do SWR da lista e pontos de releitura: 05.
- Server Actions `connectAgent` e `disconnectAgent`: 06 e 07.

**Bloqueada por:** 07 (Desconectar um Agente)

- [x] **CA1** · `POST /v1/agents/changed` responde 204 a um administrador e publica `agents.changed`,
  sem conteúdo, na sala `workspace`; 403 a quem não administra, inclusive depois de perder o papel
  com a mesma Sessão; 401 sem Sessão.
- [x] **CA2** · O evento entra em `ServerToClientEvents` do `packages/chat-events`, sem guardar nos
  eventos por Pessoa; o teste com `socket.io-client` prova a entrega a todas as Pessoas conectadas,
  inclusive às outras abas de quem pediu, e que ele não volta na reconexão com cursor.
- [x] **CA3** · `connectAgent` e `disconnectAgent` chamam a rota depois do sucesso no Serviço de
  agentes; uma falha nesse passo só vai para o log, e a ação devolve `ok`.
- [x] **CA4** · O cliente relê a lista no `agents.changed` e a cada conexão e reconexão do socket,
  junto do retrato de Presença.
- [x] **CA5** · O Playwright prova, com duas Pessoas, a linha aparecendo e sumindo para a outra sem
  recarregar, e o diálogo aberto dela mudando de estado.
- [x] **CA6** · Se a 09 já estiver concluída, o Playwright prova também que o chip do Agente vira
  texto comum para a outra Pessoa sem recarregar depois de desconectar; senão, esse cenário fica
  com a 09.
