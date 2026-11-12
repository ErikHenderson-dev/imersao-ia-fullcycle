# 04: Perguntar um número e receber a resposta

**Status:** concluída

**O que construir:** uma Pessoa com Permissão de dados menciona o Agente e pergunta um número do
negócio com período ("@assistente quanto faturamos em março de 2026?"), e o Agente responde na
Conversa com o número e a linha do que foi considerado, marcada com Dados de negócio: quem não tem
permissão vê a Resposta bloqueada. Quem pergunta sem permissão recebe a recusa, sem consulta.
Pergunta fora do catálogo (lista, ranking, série, contato, alteração) recebe a recusa curta. Toda
consulta fica auditada. Referências:
- spec da F13, "Catálogo e consulta", "Auditoria", "Rota de Pedido e execução" e "O Agente
  `assistente`";
- [ADR 0030](../../../../adr/0030-catalogo-fixo-de-metricas.md),
  [ADR 0013](../../../../adr/0013-somente-leitura-banco-e-codigo.md),
  [ADR 0014](../../../../adr/0014-lastro-antes-de-gravar.md);
- HLD, 6.4;
- PRD, histórias 1, 3, 5 e 8.

**Decisões consumidas de outras tarefas:**
- `requester.data_access` no estado do Pedido: 01.
- `business_data` na ação `reply`: 02.
- Schema e dados fixos do Banco de negócio e a conexão só leitura: 03.

**Bloqueada por:** 01, 02, 03

- [x] **CA1** · As seis Métricas do catálogo (faturamento líquido e, com `bruto`, bruto; pedidos;
  ticket médio; clientes ativos; clientes novos; itens vendidos) geram SQL por SQLAlchemy Core, com
  parâmetros ligados, sobre pedidos pagos e o período no fuso da empresa.
- [x] **CA2** · A conferência de somente leitura com o pglast recusa tudo o que não for um único
  `SELECT` sem `INTO`, sem trava e com funções da lista permitida, antes de a consulta rodar.
- [x] **CA3** · A consulta roda com o usuário só leitura e o `statement_timeout` do `tempo limite
  da consulta ao Banco de negócio`; estourar o tempo dá "Não consegui responder." com `error` na
  auditoria.
- [x] **CA4** · O texto da resposta sai do código, em pt-BR, com a linha "Considerado: …", e o
  lastro confere cada número antes de gravar; um número sem lastro vira "Não consegui responder."
  com `lastro_blocked`. Resultado vazio é dito como tal.
- [x] **CA5** · A tabela `business_queries` existe no Banco dos agentes, e cada chamada da
  ferramenta grava uma linha com o Pedido, os parâmetros, o SQL e o desfecho, sem o resultado; falha
  ao gravar a auditoria termina em "não consegui".
- [x] **CA6** · A ferramenta `consultar_dados` confere a Permissão de dados primeiro: sem ela, grava
  a recusa sem permissão como `reply` sem a marca, audita `no_permission` e não toca o banco; com
  ela, grava a resposta como `reply` com `business_data` e encerra a vez do modelo.
- [x] **CA7** · O estado do Pedido traz a data de hoje no fuso da empresa (`BUSINESS_TIME_ZONE`), e
  as instruções dizem o catálogo, as regras de período, que a Mensagem citada não entra na consulta
  e que a recusa curta cita as três capacidades e o que dá para perguntar.
- [x] **CA8** · Testes de unidade (SQL de cada Métrica sem coluna de contato, período com fuso,
  texto, lastro e conferência de somente leitura) e de integração (cada Métrica contra números à mão
  nos dados fixos, tempo limite, sem permissão e um Pedido com o modelo real) cobrem CA1 a CA7.
- [x] **CA9** · Um teste Playwright com o modelo real mostra o número e a linha do que foi
  considerado para a Pessoa com permissão e a Resposta bloqueada para a outra, sem recarregar.
- [x] **CA10** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.

**Modelo real:** o teste de integração (`tests/integration/test_request_business.py`) e o Playwright
de CA9 (`e2e/agentes/consulta-a-dados.spec.ts`) passaram depois que a chave do Gemini voltou a ter
crédito; antes, ela respondia 402.
