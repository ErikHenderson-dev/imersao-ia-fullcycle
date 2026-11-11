# 08: Avaliação completa, medição e acessibilidade

**Status:** em andamento

**O que construir:** a F11 fecha com a prova de qualidade: o evalset completo do resumo aprovando
≥ 98% dos casos, o p95 ≤ 5 s e o custo por Pedido medidos com o modelo padrão, e a nota 100 de
Acessibilidade do Lighthouse nos dois temas. Referências:
- spec da F11, "Decisões de teste" (avaliação, medição e roteiro manual);
- product brief, "Objetivos e métricas de sucesso" ("Qualidade do agente", "Tempo de resposta" e
  "Custo por pedido");
- PRD, "Estratégia de avaliação" e "Todas as histórias".

**Decisões consumidas de outras tarefas:**
- Mecanismo de fixtures e critérios do evalset: 04.

**Bloqueada por:** 04 (Resumo com Recorte), 05 (O Agente aparece digitando), 06 (Falhas, limite de
pedidos e teto de custo) e 07 (Escolher o Recorte por Resposta pronta ou responder sem Menção)

- [ ] **CA1** · O evalset chega a cerca de 24 casos, com as duas Conversas com instruções
  injetadas, a Pessoa citada pelo nome e por Menção, Mensagens de Agentes e apagadas no Recorte, e
  aprova ≥ 98% dos casos; o resultado e o `token_usage_v1` ficam nesta pasta.
- [ ] **CA2** · A medição do p95, da Mensagem enviada até a resposta aparecer, numa Conversa de 500
  Mensagens com o modelo padrão, e o custo por Pedido calculado dos tokens ficam nesta pasta.
- [ ] **CA3** · O roteiro manual do Lighthouse, feito por uma pessoa com uma Conversa que tem um
  resumo e uma pergunta com Respostas prontas, registra 100 nos dois temas nesta pasta.
- [ ] **CA4** · O plano de testes da F11 fica junto dos testes do Playwright, e a suíte e2e inteira
  passa antes do PR.
