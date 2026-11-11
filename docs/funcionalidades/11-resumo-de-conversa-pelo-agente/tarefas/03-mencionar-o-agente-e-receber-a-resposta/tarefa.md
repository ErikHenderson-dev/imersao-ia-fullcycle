# 03: Mencionar o Agente e receber a resposta na Conversa

**Status:** em andamento

**O que construir:** a Pessoa menciona o `@assistente` conectado numa Conversa, e a resposta dele
aparece ali para todos os Membros, sem recarregar. É o caminho inteiro do Pedido (BFF, API do chat,
Serviço de agentes e de volta), com uma resposta simples, ainda sem Recorte. As tarefas seguintes
o reaproveitam. Referências:
- spec da F11, "Pedido e ações de bot", "Envio e Pergunta pendente" (só o Pedido `new`), "Rotas do
  bot e credencial" (credencial e `reply`), "Disparo pelo BFF", "Rota de Pedido" (sem o limite),
  "Execução do Pedido" e "Ambiente de desenvolvimento";
- LLD, "Segurança" (credencial de bot), "Concorrência e idempotência" ("Ação de bot") e "Estados e
  regras" ("Pedido ao agente e Pergunta pendente");
- [ADR 0009](../../../../adr/0009-bff-dispara-agente.md),
  [ADR 0010](../../../../adr/0010-agente-grava-como-bot.md) e
  [ADR 0011](../../../../adr/0011-identificador-de-pedido.md);
- PRD, história 6.

**Decisões consumidas de outras tarefas:**
- Formato do autor da Mensagem: 01.

**Bloqueada por:** 01 (A Mensagem pode ter um bot como autor)

- [ ] **CA1** · O envio com `agent_username` cria um Pedido `new` (`agent_requests`, `bot_actions`)
  na mesma transação da Mensagem e devolve `agent_request`; `agent_username` de quem não é bot
  recebe `bot_not_found`; sem ele, `agent_request` é nulo.
- [ ] **CA2** · `CHAT_BOT_TOKEN` protege toda rota `/v1/bot` (401 `invalid_bot_token`), e
  `POST /v1/bot/requests/:id/reply` grava a resposta como bot, com `request_not_found`,
  `request_expired` depois da validade de 2 min e `request_closed`; repetir devolve a mesma
  Mensagem.
- [ ] **CA3** · O BFF reconhece o `@usuário` de um Agente conectado no texto, pelo registro, com o
  limite de palavra, só quando há `@`; com o registro fora, envia sem `agent_username`. Com
  `agent_request`, chama `POST /v1/requests`.
- [ ] **CA4** · `POST /v1/requests` confere a credencial de serviço e o Agente no catálogo
  (`agent_not_found`), responde 202 e roda o `Runner` numa sessão nova do ADK com o id do Pedido,
  com o contexto por `state_delta`; o código grava o texto final como `reply` pelo cliente da API
  do chat.
- [ ] **CA5** · O compose passa `CHAT_BOT_TOKEN` aos dois serviços e `CHAT_API_URL` ao Serviço de
  agentes.
- [ ] **CA6** · Os testes de ponta a ponta da API do chat cobrem CA1 e CA2; os de integração do
  Serviço de agentes, com uma API do chat falsa em `127.0.0.1`, provam o 401, o 404, o 202 e o
  `reply` gravado.
- [ ] **CA7** · O Playwright prova, com o modelo real, a Menção ao `@assistente` e a resposta
  chegando às duas Pessoas sem recarregar, e ganha o apoio para agir como bot pelas rotas `/v1/bot`
  a partir do Pedido que o envio criou, usado pelas tarefas seguintes.
