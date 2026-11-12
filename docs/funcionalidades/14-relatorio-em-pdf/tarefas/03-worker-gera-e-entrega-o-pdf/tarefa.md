# 03: Worker gera e entrega o PDF de um período

**Status:** concluída

**O que construir:** um Pedido demorado posto na fila vira um PDF entregue na Conversa: o Worker
consulta as seis Métricas no período e no período anterior, monta o Relatório com as variações e o
que cada Métrica considera, confere que todo número do PDF tem lastro, grava o arquivo no
armazenamento de objetos e o entrega pela API do chat, sem chamar o modelo. Cada Relatório fica
auditado. Referências:
- spec da F14, "Fila e job", "Worker de agentes", "O PDF", "Armazenamento", "Trava de um Relatório
  por vez", "Auditoria" e "Ambiente de desenvolvimento";
- [ADR 0006](../../../../adr/0006-worker-separado.md),
  [ADR 0013](../../../../adr/0013-somente-leitura-banco-e-codigo.md),
  [ADR 0014](../../../../adr/0014-lastro-antes-de-gravar.md);
- HLD, 6.5;
- PRD, histórias 1 e 3.

**Decisões consumidas de outras tarefas:**
- Contrato de `report-delivered` e o `CHAT_WORKER_TOKEN`, fixados na spec e implementados na 01 e
  na 02; aqui, os testes usam a API do chat falsa com o mesmo contrato.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [x] **CA1** · O serviço `worker` sobe no compose com a mesma imagem do `agents` e roda o Worker
  do arq com o comando registrado no `AGENTS.md`; o `config.py` separa o que cada processo exige, e
  o Worker não recebe a chave do modelo nem o `CHAT_BOT_TOKEN`.
- [x] **CA2** · A carga do job (Pedido, Pessoa, Conversa, texto para a auditoria, os dois períodos,
  o filtro por id ou nulo e o instante do Pedido) e a chave da trava por Pessoa ficam definidas
  aqui, com o id do Pedido como `job_id`.
- [x] **CA3** · Uma consulta por período calcula as seis Métricas a partir do catálogo, passa pela
  conferência de somente leitura e roda com o usuário só leitura e o `tempo limite da consulta ao
  Banco de negócio`; as variações seguem a regra da F13, com base zero e período sem pedidos pagos.
- [x] **CA4** · O PDF, com fpdf2 e a Lato embutida, segue o layout da spec e o frame do Figma criado
  antes do código, com texto selecionável, metadados fixos e o nome do arquivo da spec.
- [x] **CA5** · O lastro extrai o texto do PDF com o pypdf e confere cada número; sem lastro, nada é
  entregue.
- [x] **CA6** · O PDF é gravado em `reports/<id do Pedido>.pdf` pelo boto3, com o bucket criado na
  subida só com `S3_CREATE_BUCKET`; a auditoria ganha `kind` e o desfecho `delivered` numa migração
  do Alembic e é gravada antes de `report_delivered`; a trava é solta só se for do mesmo Pedido.
- [x] **CA7** · Testes de unidade (consulta compilada, nome do arquivo, lastro sobre o texto do PDF)
  e de integração (o job completo contra o gabarito dos dados fixos, com a API do chat falsa e o S3
  do contêiner, conferindo o texto extraído do PDF) cobrem CA2 a CA6.
- [x] **CA8** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
