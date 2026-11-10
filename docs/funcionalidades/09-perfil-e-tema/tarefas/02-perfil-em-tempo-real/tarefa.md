# 02: Perfil em tempo real

**Status:** concluída

**O que construir:** quando uma Pessoa salva o Perfil, as outras veem o nome novo na hora, sem
recarregar e em todas as abas: nas Mensagens já carregadas, nas Citações, na barra lateral, em
"Membros de #nome", nos resultados de busca, no cabeçalho da Conversa direta e no "digitando";
as outras abas de quem editou também mudam o Rail e o menu do avatar. Esta tarefa decide a sala
`workspace`, o evento `person.updated` e a camada de Pessoas do cliente, com os componentes de
Pessoa que leem dela, que a 03 e a 04 reaproveitam para o Status e a Presença. Referências:
- spec da F09, "Tempo real", "Módulos" e "Cliente" ("Camada de Pessoas");
- LLD, "Cliente" ("Camada de Pessoas") e a linha do WebSocket em "Interfaces";
- PRD, história 1 e "Regras desta funcionalidade".

**Bloqueada por:** 01 (Editar o próprio Perfil)

- [x] **CA1** · Todo socket entra na sala `workspace` no handshake.
- [x] **CA2** · A edição do Perfil que muda algo publica `person.updated` (`id`, `name`,
  `username`, `title`) depois do commit para a sala `workspace`, inclusive para as outras abas de
  quem editou; a edição sem mudança não publica; o evento não é guardado nem reenviado na
  reconexão, e entra no contrato do pacote de eventos.
- [x] **CA3** · Depois de editar o nome, o `typing.start` da Pessoa sai com o nome novo, sem
  reconectar.
- [x] **CA4** · A camada de Pessoas guarda, por id, o nome, as iniciais, o `@usuário` e o cargo,
  começa com a Pessoa da Sessão e aplica o `person.updated` em função pura testada; só os
  componentes da Pessoa que mudou rendem de novo.
- [x] **CA5** · Os componentes de Pessoa (nome e avatar) usam a entrada da camada e, sem ela, o
  payload, em todos os lugares listados acima; na reconexão, a lista de Conversas e o perfil aberto
  são revalidados.
- [x] **CA6** · O Playwright, com duas Pessoas em dois contextos, prova o nome novo numa Mensagem
  antiga, na barra lateral, nos Membros e no perfil sem recarregar, e nas outras abas de quem
  editou.
