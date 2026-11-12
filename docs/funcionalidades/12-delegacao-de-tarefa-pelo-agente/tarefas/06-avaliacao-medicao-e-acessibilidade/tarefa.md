# 06: Avaliação, medição e acessibilidade da delegação

**Status:** concluída

**O que construir:** quem mantém o Agente consegue trocar instruções ou modelo sabendo que a
delegação continua certa: a avaliação completa cobre a delegação e reprova Responsável errado e
título com detalhe acrescentado. O Pedido de delegação comum responde no tempo do brief, e as telas
novas passam na acessibilidade. Referências:
- spec da F12, "Decisões de teste" (avaliação, medição, verificações e roteiro manual);
- PRD, seção 3, "Estratégia de avaliação";
- product brief, "Qualidade do agente", "Tempo de resposta" e "Custo por pedido".

**Decisões consumidas de outras tarefas:**
- Ferramentas `delegar_tarefa` e `perguntar_delegacao` e as instruções: 01, 04 e 05.

**Bloqueada por:** 03, 04, 05

- [x] **CA1** · A forma de checar o `responsavel` exatamente e o `titulo` pelo juiz no `adk eval`
  é decidida consultando o MCP `adk-docs` e registrada no plano.
- [x] **CA2** · O evalset do `assistente` ganha cerca de 18 casos de delegação, cobrindo as
  categorias da spec, e o caso `fora_tarefa` passa a ser uma delegação.
- [x] **CA3** · A avaliação completa, com os casos de resumo e de delegação, atinge ≥ 98% de
  aprovação, com o custo por caso informado pelo `token_usage_v1`.
- [x] **CA4** · O p95 do Pedido de delegação completo, da Mensagem enviada até a confirmação, fica ≤
  5 s com o modelo padrão, registrado na pasta desta tarefa.
- [x] **CA5** · A checagem com `@axe-core/playwright` na aba Tarefas e na aba Todas com Notificações
  de Tarefa passa nos dois temas, e a validação visual com o `playwright-cli` em 1440 × 900 é
  registrada aqui.
- [ ] **CA6** · O roteiro manual registra a nota 100 de Acessibilidade do Lighthouse nos dois temas
  na aba Tarefas.

**Registros:** [avaliacao.md](avaliacao.md) (43 de 43, com a conferência da delegação por
`ignore_args` num evalset próprio, vista no código do ADK porque o MCP `adk-docs` não conectou),
[medicao-p95.md](medicao-p95.md) (p95 de 1,86 s), [validacao-visual.md](validacao-visual.md) e
[roteiro-lighthouse.md](roteiro-lighthouse.md).

**Pendências:**
- **CA6:** dispensado pelo usuário em 2026-11-12, como na F11; o axe nos dois temas passa na aba Tarefas e na aba Todas (`e2e/acessibilidade/tarefas-sem-violacoes.spec.ts`), e o roteiro fica em `roteiro-lighthouse.md` para quando for rodado.
- **CA1:** confirmar com o MCP `adk-docs`, quando ele conectar, que `ignore_args` num evalset próprio
  é a forma recomendada.
