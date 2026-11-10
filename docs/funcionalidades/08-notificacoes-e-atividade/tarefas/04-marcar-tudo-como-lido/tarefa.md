# 04: Marcar tudo como lido

**Status:** a fazer

**O que construir:** "Marcar tudo como lido", na tela Atividade, deixa todas as Notificações lidas,
zera o número do rail e os contadores das abas em todas as abas e navegadores da Pessoa, e não muda
o negrito nem os contadores da barra lateral. A Pessoa ganha a marca de Atividade, que só avança.
Referências:
- spec da F08, "Notificações e contagem" (tabela `people` e "Avançar a marca de Atividade"),
  "Rotas" (`PUT /v1/activity/read`), "BFF" e "Cliente" ("Tela Atividade");
- ADR 0027; LLD, "Concorrência e idempotência" ("Notificações");
- PRD, história 5.

**Decisões consumidas de outras tarefas:**
- A função de Notificações e o contrato das rotas: 01.
- A forma do `activity.unread`: 03.

**Bloqueada por:** 03 (Atividade em tempo real)

- [ ] **CA1** · A migração acrescenta a marca de Atividade à Pessoa, nula nas que já existem; o
  teste da migração prova isso.
- [ ] **CA2** · A contagem e o estado de lido passam a considerar o maior entre a Última leitura e
  a marca.
- [ ] **CA3** · `PUT /v1/activity/read` avança a marca só para frente e responde os números; uma
  posição igual ou anterior responde 200 sem gravar nem publicar; Mensagem inexistente ou de
  Conversa de que a Pessoa não é Membro, 404; sem Sessão, 401. A Última leitura das Conversas não
  muda.
- [ ] **CA4** · A marca que avançou entrega `activity.unread` a todas as abas da Pessoa.
- [ ] **CA5** · O botão segue os frames "habilitado", "desabilitado" (sem não lidas) e "Marcando
  tudo", manda o id da Notificação mais nova carregada em Todas e, na falha, mostra o toast de erro.
- [ ] **CA6** · O Playwright prova que marcar tudo zera o rail nas duas abas e mantém o negrito da
  barra lateral.
