# 02: Entrega do Relatório com o cartão e o download

**Status:** concluída

**O que construir:** o bot entrega na Conversa um PDF já gravado no armazenamento de objetos, e a
Mensagem de entrega mostra, a quem tem Permissão de dados, o cartão com o nome do arquivo, o tamanho
e o botão "Baixar"; os outros Membros veem a Resposta bloqueada, sem cartão. "Baixar" confere a
permissão de quem clicou naquele momento e baixa o PDF por um link curto, dias depois da entrega,
inclusive depois de recarregar a página. Referências:
- spec da F14, "Ações de bot do Relatório", "Referência ao PDF e download", "Armazenamento" e
  "Cliente (web)";
- HLD, 6.5;
- PRD, histórias 4, 5 e 6.

**Decisões consumidas de outras tarefas:**
- Tipos de ação, regra de terminal única, Menção e guard do Worker: 01.
- Chave `reports/<id do Pedido>.pdf` e variáveis de S3, fixadas na spec e gravadas pelo Worker: 03.

**Bloqueada por:** 01

- [x] **CA1** · A tabela `message_reports` existe; `POST /v1/bot/requests/:id/report-delivered`,
  só com o `CHAT_WORKER_TOKEN`, grava numa transação a Mensagem com a marca, "@<usuário>, o
  relatório está pronto.", a linha de `message_reports` e a Menção a quem pediu; valida o prefixo da
  chave e o nome do arquivo.
- [x] **CA2** · `toMessageResponse` e o `MessagePayload` de `chat-events` trazem
  `report: { file_name, size_bytes }`, nulo na versão bloqueada, no histórico, no tempo real, na
  reconexão e na Atividade; a chave no S3 nunca sai da API.
- [x] **CA3** · `GET /v1/messages/:id/report` devolve a URL assinada pela `validade da URL do PDF`,
  com o endereço público do S3 e o nome do arquivo no `Content-Disposition`; 403
  `data_access_required` sem permissão e 404 para quem não é Membro ou Mensagem sem relatório.
- [x] **CA4** · A rota do BFF `GET /api/messages/[id]/report` responde 302 para a URL assinada e
  mostra um erro curto no 403 e no 404.
- [x] **CA5** · O `ReportCard` aparece abaixo do texto do Agente na entrega, focável e acionado pelo
  teclado, conferido com o frame do Figma criado antes do código para a entrega e a entrega
  bloqueada, nos dois temas.
- [x] **CA6** · Testes de ponta a ponta por HTTP (com o S3 do contêiner), com `socket.io-client` e
  Vitest (tamanho do arquivo) cobrem CA1 a CA4, e um teste Playwright, com um PDF de exemplo no S3 e
  a entrega pela rota do bot, baixa o arquivo para quem tem permissão, mostra a Resposta bloqueada e
  o 403 do link para a outra Pessoa.
- [x] **CA7** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
