# 01: Aviso de início e falha do Relatório na Conversa

**Status:** a fazer

**O que construir:** o bot consegue gravar na Conversa o Aviso de início de um Relatório e, depois
dele, o "não consegui gerar o relatório". O aviso estende a validade do Pedido, para o resultado
poder chegar minutos depois; a falha menciona quem pediu, que recebe a Notificação de Menção e cai
na Mensagem ao clicar. As duas Mensagens têm Dados de negócio: quem não tem Permissão de dados vê a
Resposta bloqueada, em tempo real, no histórico, na reconexão e na Notificação. Referências:
- spec da F14, "Ações de bot do Relatório" e "Cliente (web)";
- LLD, "Concorrência e idempotência" (ação de bot) e "Segurança" (credencial do Worker);
- [ADR 0027](../../../../adr/0027-notificacoes-calculadas.md);
- PRD, histórias 4, 6 e 8.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · As ações `report_started`, `report_delivered` e `report_failed` entram no CHECK de
  `bot_actions` numa migração; `report_delivered` e `report_failed` sem `report_started` recebem
  `report_not_started` (409), são exclusivas entre si (`request_closed`) e a repetição devolve a
  mesma Mensagem. A rota de `report_delivered` fica para a tarefa 02.
- [ ] **CA2** · `POST /v1/bot/requests/:id/report-started` grava o aviso com a marca, estende o
  `expires_at` do Pedido pela `validade do identificador de pedido` do Pedido demorado e emite o fim
  do "digitando"; uma ação depois de 2 min e dentro da validade nova é aceita.
- [ ] **CA3** · `POST /v1/bot/requests/:id/report-failed` grava, com a marca, "@<usuário>, não
  consegui gerar o relatório." montado pela API do chat e a Menção a quem pediu; quem pediu recebe o
  `activity.unread` e vê a Notificação, completa com permissão e bloqueada sem.
- [ ] **CA4** · O `CHAT_WORKER_TOKEN` entra no schema das variáveis e no compose; um guard novo o
  confere com comparação de tempo constante; `report-started` aceita só o segredo de bot,
  `report-failed` aceita os dois, e as outras rotas `/v1/bot` recusam o segredo do Worker com 401.
- [ ] **CA5** · Antes do código, o Figma ganha os frames do Aviso de início, do "não consegui gerar
  o relatório" e da recusa de Relatório em andamento, nos dois temas, no padrão do design system.
- [ ] **CA6** · Testes de ponta a ponta por HTTP e com `socket.io-client` cobrem CA1 a CA4, e um
  teste Playwright, com o bot agindo direto pelas rotas, mostra o aviso e a falha completos para
  quem tem permissão e bloqueados para a outra Pessoa, e a Notificação da falha levando à Mensagem.
- [ ] **CA7** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
