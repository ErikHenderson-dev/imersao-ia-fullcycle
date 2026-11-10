# 02: Ler a Conversa

**Status:** concluída

**O que construir:** abrir uma Conversa com a aba do navegador em foco a marca como lida, e as
Mensagens que chegam com ela aberta e em foco já entram lidas. Com a aba em segundo plano, ou com
outra Conversa aberta, nada fica lido; ao voltar o foco, a Conversa aberta fica lida. A Conversa
aberta com a aba em foco não mostra negrito nem contador. Esta tarefa decide o que é "aba em foco"
e a regra de exibição da Conversa aberta em foco, que a 04 e a 05 reaproveitam. Os números das
outras abas mudam na 03; aqui, ao recarregar. Referências:
- spec da F07, "Última leitura e contagem" ("Avançar a Última leitura"), "Rotas"
  (`PUT /v1/conversations/:conversationId/read`), "BFF" (`markConversationRead`) e "Cliente" ("Foco
  da aba", "Informar a leitura" e "Lista de Conversas e barra lateral");
- LLD, "Concorrência e idempotência" ("Última leitura") e "Valores de regra" ("Intervalo do aviso
  de leitura");
- PRD, "Regras desta funcionalidade" ("Ler") e histórias 1 e 2.

**Decisões consumidas de outras tarefas:**
- Os campos da lista de Conversas e a função de contagem: 01.

**Bloqueada por:** 01 (Números na barra lateral)

- [x] **CA1** · `PUT /v1/conversations/:conversationId/read` avança a Última leitura só para frente
  e responde com a posição e os números; uma posição igual ou anterior responde 200 sem gravar;
  Mensagem inexistente ou de outra Conversa: 404 `message_not_found`; quem não é Membro: 404
  `conversation_not_found`; sem Sessão: 401. A Mensagem apagada vale como posição.
- [x] **CA2** · A Server Action `markConversationRead` segue a união discriminada da F01, e o 401
  leva a `GET /api/session/expired`.
- [x] **CA3** · Um hook diz se a aba está em foco (visível e com foco), atualizado por
  `visibilitychange`, `focus` e `blur`.
- [x] **CA4** · Com a Conversa aberta, a aba em foco e o histórico carregado, o cliente informa a
  Mensagem salva mais nova ao abrir, ao voltar o foco e quando chega Mensagem, em no máximo um
  aviso por Conversa por intervalo, só quando ela é posterior à Última leitura conhecida; o `ok`
  aplica os números na lista, e a falha não mostra nada. O agrupamento é uma função pura com teste.
- [x] **CA5** · A Conversa aberta com a aba em foco é exibida sem negrito e sem contador, qualquer
  que seja o número no cache, por uma função pura com teste.
- [x] **CA6** · O Playwright prova abrir um Canal com Menção e, ao recarregar, ver a linha sem
  negrito nem contador, e que a aba em segundo plano não marca como lida.
