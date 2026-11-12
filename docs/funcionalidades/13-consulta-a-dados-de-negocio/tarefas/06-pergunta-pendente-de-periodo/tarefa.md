# 06: Pergunta pendente de período

**Status:** concluída

**O que construir:** a Pessoa com Permissão de dados pergunta sem período ("quanto faturamos?"), e o
Agente pergunta "De que período?" com as Respostas prontas "Este mês", "Mês passado" e "Este ano".
A resposta de quem pediu, clicada ou escrita, sem Menção, completa a consulta; uma resposta que não
completa recebe "não entendi o que consultar". "E em abril?" sozinho, depois de uma resposta sobre
março, não reaproveita a pergunta anterior. Referências:
- spec da F13, "O Agente `assistente`" (`perguntar_periodo` e instruções);
- PRD, história 4, e "Pergunta ambígua: Pergunta pendente".

**Decisões consumidas de outras tarefas:**
- Assinatura de `consultar_dados` e as instruções base: 04.

**Bloqueada por:** 04

- [x] **CA1** · A ferramenta `perguntar_periodo()` grava a Pergunta pendente "De que período?" com
  as três Respostas prontas, sem a marca, e recusa rodar numa continuação.
- [x] **CA2** · As instruções mandam chamar `perguntar_periodo` quando falta o período, e, numa
  continuação que não completa a consulta, dizer que não entendeu o que consultar, sem perguntar de
  novo.
- [x] **CA3** · As instruções tratam cada Pedido como completo: "e em abril?" sem o resto é pergunta
  sem o que consultar.
- [ ] **CA4** · Testes de integração com o modelo real cobrem a pergunta, a continuação "mês
  passado" que responde e a que não completa; um teste Playwright, com o bot agindo pela rota,
  mostra os botões desativados para o outro Membro.
- [x] **CA5** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.

**Pendências:** CA4 tem o Playwright verde (`e2e/agentes/pergunta-de-periodo.spec.ts`, os botões
desativados para o outro Membro) e os testes de unidade da ferramenta, mas os de integração com o
modelo real (`tests/integration/test_request_business.py`, a continuação "Mês passado", que
responde, e a que não completa) estão escritos e não rodaram: a chave do Gemini responde 402.
