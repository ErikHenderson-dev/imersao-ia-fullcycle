# 07: Avaliação, medição e acessibilidade do Relatório

**Status:** concluída

**O que construir:** quem mantém o Agente consegue trocar instruções ou modelo sabendo que o pedido
de Relatório continua sendo entendido: a avaliação completa cobre o Relatório, com o período e o
filtro conferidos contra o gabarito. O aviso e a entrega chegam no tempo do PRD, e as telas novas
passam na acessibilidade. Referências:
- spec da F14, "Decisões de teste" (avaliação, medição, verificações e roteiro manual);
- PRD, seção 3, "Estratégia de avaliação";
- product brief, "Qualidade do agente", "Número errado entregue", "Tempo de resposta" e "Custo por
  pedido".

**Decisões consumidas de outras tarefas:**
- Ferramenta `gerar_relatorio` e as instruções: 04 e 05.
- Novas tentativas e falhas: 06.

**Bloqueada por:** 05, 06

- [x] **CA1** · A forma de rodar `gerar_relatorio` até o aviso no `adk eval`, sem Worker, é decidida
  consultando o MCP `adk-docs` e registrada no plano.
- [x] **CA2** · O evalset `relatorio` tem cerca de 15 casos com configuração própria, cobrindo as
  categorias da spec, com os argumentos esperados de `gerar_relatorio` e a rubrica do juiz.
- [x] **CA3** · A avaliação completa, com os casos de resumo, delegação, consulta e Relatório,
  atinge ≥ 98% de aprovação, com o custo por caso informado.
- [x] **CA4** · O p95 ≤ 5 s do aviso e o p95 ≤ 60 s da entrega, da Mensagem enviada até a do Agente
  aparecer, com o modelo padrão, ficam em `medicao-p95.md` na pasta desta tarefa.
- [x] **CA5** · A checagem com `@axe-core/playwright` na Conversa com uma entrega completa e uma
  bloqueada, nos dois temas, não tem violações, e a validação visual com o `playwright-cli` compara
  as telas e o PDF com os frames do Figma.
- [x] **CA6** · O roteiro manual da nota 100 de Acessibilidade do Lighthouse nos dois temas fica na
  pasta desta tarefa.
- [x] **CA7** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
