# 05: Comparação entre períodos e filtro por nome

**Status:** em andamento

**O que construir:** a Pessoa com Permissão de dados compara dois períodos ("faturamento de março
contra fevereiro") e recebe os dois valores e a variação, e pergunta sobre um cliente, vendedor ou
produto pelo nome ("quantos pedidos a Ana fechou em março?"). Um nome sem achado recebe "não
encontrei"; um nome que bate com dois a cinco cadastros recebe a Pergunta pendente com uma Resposta
pronta por nome completo; com mais, o pedido de um nome mais específico. Referências:
- spec da F13, "Catálogo e consulta" (comparação, `names.py`) e "O Agente `assistente`" (passo 3
  de `consultar_dados`);
- PRD, histórias 2 e 4, e "O que dá para perguntar".

**Decisões consumidas de outras tarefas:**
- Assinatura de `consultar_dados`, desfechos da auditoria e formato do texto: 04.
- `business_data` na ação `question`: 02.
- Os nomes repetidos dos dados fixos: 03.

**Bloqueada por:** 04

- [ ] **CA1** · Com `comparar_inicio` e `comparar_fim`, o código consulta os dois períodos e
  escreve os dois valores e a variação percentual com uma casa e sinal; com a base zero, diz que não
  há variação percentual. A comparação vale para todas as Métricas e com o mesmo filtro.
- [ ] **CA2** · O nome é procurado por trecho, sem diferença de maiúsculas e acentos, na tabela do
  tipo pedido.
- [ ] **CA3** · Nenhum achado grava "Não encontrei {tipo} {nome}." como `reply` com a marca
  (`not_found`); dois a cinco gravam a Pergunta pendente de nome com a marca e uma Resposta pronta
  por nome completo (`ambiguous_name`); mais de cinco gravam o pedido de nome mais específico com a
  marca (`too_generic`).
- [ ] **CA4** · A continuação com um dos nomes responde com a consulta filtrada.
- [ ] **CA5** · Testes de unidade (variação, base zero, busca sem acento) e de integração (comparação
  e filtro contra números à mão, os três desfechos de nome e a continuação) cobrem CA1 a CA4.
- [ ] **CA6** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
