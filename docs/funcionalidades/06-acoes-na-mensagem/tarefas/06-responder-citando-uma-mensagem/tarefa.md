# 06: Responder citando uma Mensagem

**Status:** a fazer

**O que construir:** qualquer Membro escolhe "Responder" numa Mensagem; a caixa de mensagem mostra
"Respondendo a <nome>" com o começo do texto, e a Mensagem enviada aparece com a Citação acima do
texto. A Citação acompanha a edição da original e vira "Em resposta a uma mensagem apagada" quando
ela é apagada, para todos, sem recarregar. Se a Mensagem que a pessoa está citando for apagada, a
Citação sai da caixa com um aviso. Referências:
- spec da F06, "Mensagens" ("Enviar com Citação" e "A Mensagem no REST e nos eventos"), "Rotas",
  "BFF" e "Cliente" ("Citação", "Eventos no cliente" e "Telas");
- PRD, histórias 3 e 7.

**Decisões consumidas de outras tarefas:**
- Estrutura da barra de ações e do menu: 02.
- `message.updated` e sua aplicação no cache: 03.
- `message.deleted` e sua aplicação no cache: 04.

**Bloqueada por:** 03 (Editar a própria Mensagem), 04 (Apagar a própria Mensagem)

- [ ] **CA1** · `messages` ganha `quoted_message_id`. O envio aceita `quoted_message_id`: a original
  precisa ser da mesma Conversa e não apagada, senão `quoted_message_not_found` (404), que entra no
  catálogo e no filter global; o reenvio idempotente devolve a Mensagem já gravada sem olhar a
  Citação.
- [ ] **CA2** · A Mensagem no REST e nos eventos ganha `quote` (nula sem Citação; com ela, `id` e
  `deleted` e, não apagada, `author` e o `body` atual), carregada por página numa consulta só no
  histórico.
- [ ] **CA3** · "Responder" entra na barra e no menu de toda Mensagem enviada, guarda a Citação na
  caixa daquela Conversa e leva o foco à textarea; a caixa mostra "Respondendo a <nome>", o começo
  do texto e "Cancelar resposta". Esc com a lista de menções fechada, ou o botão, desistem;
  responder a outra troca a Citação; trocar de Conversa a limpa.
- [ ] **CA4** · `sendMessage` leva `quotedMessageId`; a Mensagem pendente mostra a Citação com os
  dados da tela; o `not_found` vira a falha no envio da F02 com a mensagem de que a citada foi
  apagada.
- [ ] **CA5** · A ReplyQuote mostra o nome do autor e o começo do texto, numa linha, ou "Em resposta
  a uma mensagem apagada", sem ação. O `message.updated` atualiza a `quote` das Mensagens carregadas
  que citam a editada, e o `message.deleted` a marca como apagada; o `message.deleted` da Mensagem
  citada na caixa tira a Citação, com o aviso.
- [ ] **CA6** · Os testes de ponta a ponta da API provam o envio com Citação, os 404 da Citação de
  outra Conversa, inexistente e apagada, o reenvio sem mudar a Citação, a `quote` com o texto editado
  e a `quote` apagada no histórico. O Vitest prova a atualização das `quote` no cache.
- [ ] **CA7** · O Playwright prova, com duas Pessoas, responder citando só pelo teclado, desistir
  com Esc, a Citação mudando na outra quando a original é editada e virando "Em resposta a uma
  mensagem apagada" quando ela é apagada, e o axe com a caixa em "Citando", sem violações.
- [ ] **CA8** · A validação visual de "Citando", "Com citação" e "Citação apagada", nos dois temas,
  contra os frames, fica nesta pasta.
