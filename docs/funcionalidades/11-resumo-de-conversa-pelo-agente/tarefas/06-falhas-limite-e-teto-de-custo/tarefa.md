# 06: Falhas, limite de pedidos e teto de custo

**Status:** em andamento

**O que construir:** quando o Agente não consegue atender, ninguém fica esperando: com o modelo
fora ou com erro, ele grava na Conversa que não conseguiu resumir; com o Serviço de agentes fora
ou acima de 10 pedidos por minuto, só quem pediu vê o erro ao lado da Mensagem; com o Agente
desconectado no meio do caminho, nada acontece, como texto comum. Cada Pedido tem o custo limitado e
fica no log. Referências:
- spec da F11, "Pedido e ações de bot" (encerramento), "Disparo pelo BFF", "Rota de Pedido" (limite
  e 409), "Execução do Pedido" ("Fim do Pedido" e "Log"), "Modelo de IA" (teto) e "Cliente" ("Erro
  do Agente");
- LLD, "Erros", "Logs", "Integrações externas" ("Contadores (Redis)") e "Valores e configuração";
- PRD, história 7.

**Decisões consumidas de outras tarefas:**
- Validação do Pedido e ponto em que o texto final vira `reply`: 03.
- Apoio de Playwright para agir como bot: 03.

**Bloqueada por:** 03 (Mencionar o Agente e receber a resposta na Conversa)

- [ ] **CA1** · Antes do código, o Figma ganha o "não consegui" e os dois erros do Agente ao lado da
  Mensagem, nos dois temas.
- [ ] **CA2** · O Serviço de agentes ganha o Redis e `AGENT_REQUESTS_PER_MINUTE`: o 11º Pedido da
  mesma Pessoa no minuto recebe 429 `rate_limited`, o Agente desconectado recebe 409
  `agent_not_connected`, e o Redis fora recusa com `agents_unavailable`.
- [ ] **CA3** · `POST /v1/agent-requests/:id/close` encerra o Pedido de quem pediu como `failed` ou
  `cancelled`, responde 204 repetido e recusa o de outra Pessoa; depois disso, as ações do bot
  recebem `request_closed`.
- [ ] **CA4** · O BFF encerra como `failed` no Serviço de agentes fora, no tempo esgotado e no 429,
  devolvendo o erro `unavailable` ou `rate_limited`, e como `cancelled` no 409, sem erro.
- [ ] **CA5** · Erro do modelo, teto de chamadas atingido ou exceção inesperada gravam o `reply`
  fixo do "não consegui"; `max_llm_calls` 4 e `max_output_tokens` 1024 valem em todo Pedido.
- [ ] **CA6** · Um log `info` por Pedido traz o identificador, o desfecho, o tempo e os tokens, e o
  limite gera `warn`, sem texto de Mensagem.
- [ ] **CA7** · Os testes de integração do Serviço de agentes provam o 429, o 409 e o "não consegui"
  com a API falsa falhando; os de ponta a ponta da API do chat provam o encerramento.
- [ ] **CA8** · O Playwright prova o erro só para quem pediu com o Serviço de agentes parado, o
  Pedido `failed`, e o "não consegui" pelo bot agindo pelas rotas; a validação visual fica nesta
  pasta.
