# 07: Avaliação, medição e acessibilidade da consulta

**Status:** a fazer

**O que construir:** quem mantém o Agente consegue trocar instruções ou modelo sabendo que a
consulta continua certa: a avaliação completa cobre a consulta, com o número conferido contra o
gabarito dos dados fixos. A consulta comum responde no tempo do brief, e as telas novas passam na
acessibilidade. Referências:
- spec da F13, "Decisões de teste" (avaliação, medição, verificações e roteiro manual);
- PRD, seção 3, "Estratégia de avaliação";
- product brief, "Qualidade do agente", "Número errado entregue", "Tempo de resposta" e "Custo por
  pedido".

**Decisões consumidas de outras tarefas:**
- Ferramentas `consultar_dados` e `perguntar_periodo` e as instruções: 04, 05 e 06.
- Dados fixos do Banco de negócio: 03.

**Bloqueada por:** 05, 06

- [ ] **CA1** · A forma de rodar `consultar_dados` contra o Banco de negócio real no `adk eval`, com
  o `eval_fixtures.py` deixando a ferramenta passar e o "hoje" em 15/10/2026, é decidida consultando
  o MCP `adk-docs` e registrada no plano.
- [ ] **CA2** · O evalset `dados` tem 30 casos com configuração própria, cobrindo as categorias da
  spec, e o caso `fora_dados` da F11 passa a ser uma consulta.
- [ ] **CA3** · A avaliação completa, com os 73 casos de resumo, delegação e consulta, atinge ≥ 98%
  de aprovação, com o custo por caso informado.
- [ ] **CA4** · O p95 da consulta completa, da Mensagem enviada até a resposta aparecer, fica ≤ 5 s
  com o modelo padrão, registrado na pasta desta tarefa.
- [ ] **CA5** · A checagem com `@axe-core/playwright` na Conversa com uma resposta completa e uma
  bloqueada, nos dois temas, não tem violações.
- [ ] **CA6** · O roteiro manual da nota 100 de Acessibilidade do Lighthouse nos dois temas fica na
  pasta desta tarefa.
- [ ] **CA7** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
