# 03: Editar a própria Mensagem

**Status:** a fazer

**O que construir:** o autor escolhe "Editar" na barra ou no menu de uma Mensagem dele, edita o
texto no lugar da Mensagem e salva com Enter, ou cancela com Esc. O texto novo e "(editada)"
aparecem para todos os Membros da Conversa, em todas as abas, sem recarregar, e também depois de
uma queda de conexão. A Mensagem de outra Pessoa não tem "Editar". Referências:
- spec da F06, "Mensagens" ("Editar" e "A Mensagem no REST e nos eventos"), "Rotas", "Tempo real",
  "BFF" e "Cliente" ("Texto da Mensagem", "Edição", "Eventos no cliente" e "Telas");
- LLD, "Concorrência e idempotência" ("Editar e apagar mensagem");
- PRD, histórias 5 e 7.

**Decisões consumidas de outras tarefas:**
- Eventos guardados de Mensagem tratados pelo nome no publisher, no gateway e no provedor: 01.
- Estrutura da barra de ações e do menu, Tooltip e Toaster: 02.

**Bloqueada por:** 01 (Eventos de Mensagem genéricos no tempo real), 02 (Barra de ações, menu e
copiar o texto)

- [ ] **CA1** · No Figma, antes do código: criar a edição acima do limite de caracteres.
- [ ] **CA2** · `messages` ganha `edited_at`, e a Mensagem no REST e nos eventos ganha `edited_at`,
  montada pela função única da spec.
- [ ] **CA3** · `PATCH /v1/conversations/:conversationId/messages/:id` com `body`: só o autor; outra
  Pessoa, `message_not_owned` (403); inexistente, de outra Conversa ou de quem não é Membro,
  `message_not_found` (404); texto fora da validação do envio, 400. O mesmo texto responde 200 sem
  mudar `edited_at` nem publicar. Os códigos novos entram no catálogo e no filter global.
- [ ] **CA4** · A edição publica `message.updated` (a Mensagem inteira) depois do commit, a todos os
  Membros, guardado nos eventos por Pessoa e reenviado na reconexão; o tipo entra no `chat-events`.
- [ ] **CA5** · O Server Action `editMessage` devolve a união discriminada da spec. "Editar", só nas
  próprias Mensagens, abre a MessageEditor com o texto, o foco no fim, o contador de limite e a dica;
  Enter salva em "Salvando", Shift+Enter quebra a linha, Esc cancela; vazio ou acima do limite não
  salva; a falha fica em "Edição com erro" com o texto e "Tentar de novo"; uma edição por vez; ao
  fechar, o foco volta à Mensagem.
- [ ] **CA6** · O `message.updated` troca a Mensagem no cache pelo id, sem mudar a rolagem; uma
  edição aberta na mesma Mensagem continua com o que a pessoa digita. "(editada)" aparece depois do
  texto, com a hora da edição no `title`.
- [ ] **CA7** · Os testes de ponta a ponta da API provam a edição com `edited_at`, o mesmo texto sem
  mudança, o 400, o 403 e o 404; os de tempo real, o `message.updated` para os Membros e não para
  quem está fora, nada no mesmo texto e o reenvio na reconexão. O Vitest prova a troca no cache.
- [ ] **CA8** · O Playwright prova, com duas Pessoas, editar e ver o texto novo e "(editada)" na
  outra sem recarregar, a ausência de "Editar" na Mensagem da outra, cancelar com Esc, a falha ao
  salvar pelo `page.route`, o caminho só pelo teclado e o axe com a edição aberta, sem violações.
- [ ] **CA9** · A validação visual de "Editada", "Edição", "Edição salvando", "Edição com erro" e
  "Menu da própria mensagem", nos dois temas, contra os frames, fica nesta pasta.
