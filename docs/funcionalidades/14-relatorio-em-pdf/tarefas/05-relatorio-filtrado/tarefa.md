# 05: Relatório filtrado por cliente, vendedor ou produto

**Status:** a fazer

**O que construir:** uma Pessoa com Permissão de dados pede o Relatório de um período filtrado por
um cliente, vendedor ou produto citado pelo nome ("relatório de março da vendedora Ana") e recebe o
PDF com as Métricas em que o filtro se aplica filtradas, as outras com "não se aplica", e o filtro
no título, no nome do arquivo e no Aviso de início. Nome não encontrado, repetido ou genérico demais
segue as respostas da F13, sem aviso. Referências:
- spec da F14, "Ferramenta `gerar_relatorio`" (passo do nome) e "Worker de agentes" (filtro por id);
- LLD, "Estados e regras", seção "Consulta a dados de negócio";
- PRD, história 2.

**Decisões consumidas de outras tarefas:**
- Carga do job com o filtro por id: 03.
- Ferramenta, período anterior e trava: 04.

**Bloqueada por:** 04

- [ ] **CA1** · A ferramenta resolve o nome com a busca da F13: nenhum achado grava "não encontrei"
  (`not_found`), de dois a cinco a Pergunta pendente com um botão por nome completo
  (`ambiguous_name`), mais de cinco o pedido de um nome mais específico (`too_generic`), todos com a
  marca e soltando a trava antes de gravar.
- [ ] **CA2** · O job leva o filtro pelo id do cadastro, e o Worker filtra as Métricas em que o
  filtro se aplica, com "não se aplica" nas outras, sem consulta para elas.
- [ ] **CA3** · O título do PDF, o nome do arquivo e o Aviso de início trazem o filtro.
- [ ] **CA4** · Testes de unidade e de integração cobrem CA1 a CA3, com o PDF filtrado conferido
  contra o gabarito dos dados fixos.
- [ ] **CA5** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
