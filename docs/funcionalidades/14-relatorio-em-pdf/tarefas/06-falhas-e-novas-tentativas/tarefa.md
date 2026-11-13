# 06: Falhas e novas tentativas do Relatório

**Status:** concluída

**O que construir:** quando a geração de um Relatório falha por um motivo passageiro (banco de
negócio, armazenamento de objetos, tempo esgotado), o Worker tenta de novo e entrega o PDF uma vez
só. Quando não consegue, ou quando o lastro barra um número, quem pediu é mencionado no "não
consegui gerar o relatório", nenhum PDF é entregue e a Pessoa pode pedir outro Relatório. Referências:
- spec da F14, "Fila e job", "Worker de agentes" e "Ferramenta `gerar_relatorio`" (falha ao
  enfileirar);
- LLD, "Processos de segundo plano" e "Valores e configuração";
- PRD, história 8.

**Decisões consumidas de outras tarefas:**
- Ação `report_failed` e a Menção: 01.
- Carga do job e trava: 03.
- Ordem aviso e fila na ferramenta: 04.

**Bloqueada por:** 04

- [x] **CA1** · Uma tentativa que falha volta à fila até `tentativas do Worker`, com a `espera entre
  tentativas do Worker` e o `tempo limite da tentativa do Worker`, regravando a mesma chave no S3 e
  sem auditar a tentativa intermediária.
- [x] **CA2** · Esgotadas as tentativas, o Worker grava `report_failed`, audita `error` e solta a
  trava; sem lastro, faz o mesmo com `lastro_blocked`, sem nova tentativa.
- [x] **CA3** · Um Pedido recusado pela API do chat (404, `request_closed`, `request_expired`)
  encerra o job sem nova tentativa, só com o log, e solta a trava.
- [x] **CA4** · Uma falha ao enfileirar grava `report_failed`, audita `error` e solta a trava.
- [x] **CA5** · Testes de integração cobrem falha seguida de sucesso com entrega única, tentativas
  esgotadas, lastro barrado, Pedido recusado e falha ao enfileirar.
- [x] **CA6** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
