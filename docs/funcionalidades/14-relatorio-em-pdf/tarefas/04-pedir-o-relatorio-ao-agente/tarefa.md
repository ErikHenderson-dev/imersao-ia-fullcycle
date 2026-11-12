# 04: Pedir o Relatório de um período ao Agente

**Status:** a fazer

**O que construir:** uma Pessoa com Permissão de dados menciona o Agente e pede um Relatório em PDF
de um período ("@assistente me manda um relatório de março de 2026 em PDF"), vê o Aviso de início
com as datas, segue conversando e recebe o PDF na Conversa. Sem permissão, recebe a recusa; com um
Relatório já em andamento, a recusa de Relatório em andamento; sem período, a Pergunta pendente da
F13; com lista, série, gráfico, contato ou alteração, a recusa curta. Uma pergunta de número
continua respondida em texto. Referências:
- spec da F14, "Ferramenta `gerar_relatorio`", "Período anterior" e "Trava de um Relatório por
  vez";
- PRD, histórias 1, 3, 4 e 7.

**Decisões consumidas de outras tarefas:**
- Ação `report_started` e a validade estendida: 01.
- Entrega e cartão: 02.
- Carga do job e chave da trava: 03.

**Bloqueada por:** 01, 02, 03

- [ ] **CA1** · O período anterior é uma função pura (mês, trimestre e ano inteiros contra os
  anteriores inteiros; intervalo contra os mesmos dias antes; período em andamento contra o mesmo
  trecho), no fuso da empresa, com testes de unidade para virada de ano, mês mais curto e bissexto.
- [ ] **CA2** · A ferramenta `gerar_relatorio` segue a ordem da spec: permissão (recusa e
  `no_permission`, sem trava), parâmetros, trava com `SET NX` (recusa de Relatório em andamento),
  período anterior, Aviso de início pela ação `report_started` com a marca e só depois o job na
  fila; e encerra a vez do modelo.
- [ ] **CA3** · Sem período, o Agente chama `perguntar_periodo`, e a continuação gera o Relatório.
- [ ] **CA4** · As instruções dizem que só pedido explícito de relatório ou PDF vira Relatório, que
  pergunta de número vai para `consultar_dados`, o que o Relatório traz e a recusa curta atualizada.
- [ ] **CA5** · Testes de integração cobrem a ferramenta (sem permissão, trava presa, a ordem aviso
  e fila) e um Pedido com o modelo real que grava o aviso e, com o Worker, entrega o PDF.
- [ ] **CA6** · Um teste Playwright com o modelo real e o Worker rodando: a Pessoa com permissão
  pede o Relatório, vê o aviso, envia outra Mensagem, vê a entrega, baixa e confere que é um PDF; a
  outra Pessoa vê o aviso e a entrega bloqueados, sem recarregar.
- [ ] **CA7** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
