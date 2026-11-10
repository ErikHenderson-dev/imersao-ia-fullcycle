# 04: Apagar a própria Mensagem

**Status:** concluída

**O que construir:** o autor escolhe "Apagar" no menu de uma Mensagem dele, confirma no diálogo
"Apagar mensagem?" e a Mensagem sai da Conversa para todos os Membros, em todas as abas, sem
recarregar, e também depois de uma queda de conexão. O histórico deixa de trazê-la. Se a Mensagem
estava em edição em outra aba, a edição fecha com um aviso. Referências:
- spec da F06, "Mensagens" ("Apagar" e "Histórico"), "Rotas", "Tempo real", "BFF" e "Cliente"
  ("Apagar", "Eventos no cliente" e "Telas");
- LLD, "Concorrência e idempotência" ("Editar e apagar mensagem") e "Dados";
- PRD, histórias 6 e 7.

**Decisões consumidas de outras tarefas:**
- Eventos guardados de Mensagem tratados pelo nome no publisher, no gateway e no provedor: 01.
- Estrutura da barra de ações e do menu, Tooltip e Toaster: 02.

**Bloqueada por:** 01 (Eventos de Mensagem genéricos no tempo real), 02 (Barra de ações, menu e
copiar o texto)

- [x] **CA1** · `messages` ganha `deleted_at`, e o `body` passa a aceitar nulo, com o `CHECK` da
  spec (nulo se e só se apagada; senão, de 1 a 4000), numa migração escrita à mão; as Mensagens que
  já existem continuam válidas, provado no teste da migração.
- [x] **CA2** · `DELETE /v1/conversations/:conversationId/messages/:id`: só o autor; outra Pessoa,
  `message_not_owned` (403); inexistente, já apagada, de outra Conversa ou de quem não é Membro,
  `message_not_found` (404); sucesso, 204, zerando o `body` e gravando `deleted_at` numa transação
  que lê a Mensagem com a mesma trava de linha da edição. Uma edição e uma exclusão ao mesmo tempo
  terminam sem erro do banco.
  O histórico ignora as apagadas.
- [x] **CA3** · A exclusão publica `message.deleted` (`conversation_id` e `message_id`) depois do
  commit, a todos os Membros, guardado nos eventos por Pessoa e reenviado na reconexão; o tipo entra
  no `chat-events`.
- [x] **CA4** · O ConfirmDialog, sobre o AlertDialog do `radix-ui`, entra em `components/ui`. "Apagar",
  só nas próprias Mensagens e em vermelho, separado no menu, abre "Apagar mensagem?" com o texto da
  Mensagem, o foco em "Cancelar" e sem fechar pelo clique fora; Esc fecha.
- [x] **CA5** · O Server Action `deleteMessage` devolve a união discriminada da spec. "Apagar" fica em
  "Apagando"; o `ok` e o `not_found` tiram a Mensagem do cache e fecham o diálogo; a falha mantém o
  diálogo em "Erro ao apagar" com "Tentar de novo". Depois, o foco vai para a Mensagem seguinte, ou
  para a caixa de mensagem.
- [x] **CA6** · O `message.deleted` tira a Mensagem do cache pelo id, sem mudar a rolagem, e a
  seguinte do mesmo autor ganha nome e avatar quando a apagada abria o grupo. Uma edição aberta da
  Mensagem apagada fecha, com o aviso de que ela foi apagada; o `not_found` de `editMessage` faz o
  mesmo.
- [x] **CA7** · Os testes de ponta a ponta da API provam a exclusão (texto zerado, `deleted_at`), o
  histórico sem ela, o 404 ao apagar de novo, o 403 e o 404 de quem não é Membro; os de tempo real,
  o `message.deleted` para os Membros e o reenvio na reconexão; a edição e a exclusão concorrentes.
  O Vitest prova a retirada no cache, o reagrupamento e que um `message.updated` depois do
  `message.deleted` não traz a Mensagem de volta.
- [x] **CA8** · O Playwright prova, com duas Pessoas, apagar com a confirmação e ver a Mensagem
  sumir na outra sem recarregar, cancelar, a falha ao apagar pelo `page.route`, o caminho só pelo
  teclado e o axe com o diálogo aberto, sem violações.
- [x] **CA9** · A validação visual de "Confirmar apagar", "Apagando" e "Erro ao apagar", nos dois
  temas, contra os frames, fica nesta pasta.
