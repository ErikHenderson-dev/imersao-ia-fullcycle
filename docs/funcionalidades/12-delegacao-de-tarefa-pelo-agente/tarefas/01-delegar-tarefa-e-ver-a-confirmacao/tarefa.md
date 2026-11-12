# 01: Delegar uma Tarefa e ver a confirmação na Conversa

**Status:** a fazer

**O que construir:** a Pessoa menciona o Agente e um Membro da Conversa pedindo para delegar um
trabalho ("@assistente delega pra @bruno revisar o contrato"), e o Agente cria a Tarefa aberta e
confirma na Conversa, à vista de todos os Membros, com o título e o nome do Responsável. Delegar a
si mesmo ("me lembra de…") também cria a Tarefa. Delegar a quem não é Membro, a um bot ou a um nome
sem `@` recebe a recusa curta, sem Tarefa. Referências:
- spec da F12, "Tarefa", "Ação `task`", "Rota de Pedido e execução" e "O Agente `assistente`"
  (`delegar_tarefa` e instruções);
- LLD, "Concorrência e idempotência" ("Ação de bot"), "Transações" e "Estados e regras" (6.1);
- PRD, histórias 1, 7 e 8.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · A tabela `tasks` existe com as colunas, o `request_id` único e os índices da spec,
  com `status` `open` ou `done`.
- [ ] **CA2** · `POST /v1/bot/requests/:id/task` cria, numa transação com o Pedido travado, a
  Tarefa, a confirmação "Tarefa delegada a {nome}: {título}" como Mensagem do bot, sem Menção, e a
  ação `task` em `bot_actions`; responde 201 com `{ task, message }` e publica `message.created`.
- [ ] **CA3** · A ação `task` repetida devolve a mesma Tarefa e a mesma confirmação, sem nova linha
  nem evento, e respeita a credencial de bot e os estados do Pedido como as outras rotas do bot.
- [ ] **CA4** · `assignee_not_member` (422) para quem não é Membro e para `@usuário` inexistente,
  `assignee_is_bot` (422) para um bot, e o erro de validação para título vazio ou acima de 120.
- [ ] **CA5** · O estado do Pedido traz o `@usuário` de quem pediu, e "me", "mim" e "eu" viram quem
  pediu como Responsável.
- [ ] **CA6** · A ferramenta `delegar_tarefa(responsavel, titulo)` chama a ação, encerra a vez do
  modelo depois de gravar e faz o fim do Pedido não gravar `reply`; com `assignee_*`, o modelo
  grava a recusa curta como `reply`.
- [ ] **CA7** · As instruções dizem que o Agente resume e delega, que o Responsável vem só de Menção
  ou de "mim"/"me"/"eu", e que o título sai do Pedido, em até 120 caracteres, sem `@usuário` e sem
  detalhe acrescentado; a recusa curta passa a citar as duas capacidades.
- [ ] **CA8** · O "não consegui" fixo passa a ser "Não consegui atender o seu pedido agora. Tente de
  novo em instantes."
- [ ] **CA9** · Testes de ponta a ponta da API do chat (HTTP e socket) e de integração do Serviço de
  agentes cobrem CA2 a CA6, e um teste Playwright com o modelo real mostra a confirmação para duas
  Pessoas sem recarregar.
- [ ] **CA10** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
