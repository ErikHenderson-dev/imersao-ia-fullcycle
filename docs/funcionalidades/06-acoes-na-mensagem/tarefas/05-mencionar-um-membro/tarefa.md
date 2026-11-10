# 05: Mencionar um Membro

**Status:** a fazer

**O que construir:** na caixa de mensagem e na edição, digitar `@`, ou clicar no botão `@`, abre a
lista dos Membros da Conversa, filtrada pelo que se digita depois do `@`; escolher põe o
`@usuário` no texto. Na Conversa, a Menção aparece como `@usuário`, em azul, e em amarelo para a
Pessoa mencionada, que vê a Mensagem inteira com o fundo de "Menciona você". Clicar na Menção abre
o Perfil. Um `@usuário` de quem não é Membro fica como texto comum. A edição recalcula as Menções, e
as Menções de uma Mensagem apagada ficam guardadas, para a F07 e a F08. Referências:
- spec da F06, "Mensagens" ("Menções, ao gravar", "Editar", "Apagar" e "A Mensagem no REST e nos
  eventos"), "Busca de Pessoas para a lista de menções", "Rotas", "Tempo real", "BFF" e "Cliente"
  ("Texto da Mensagem", "Lista de menções" e "Telas");
- spec da F05, "Painel de perfil" e "Busca de Pessoas";
- PRD, histórias 1, 2 e 7.

**Decisões consumidas de outras tarefas:**
- Edição da Mensagem, a MessageEditor e o `message.updated`: 03.
- Exclusão da Mensagem e o `message.deleted`: 04.

**Bloqueada por:** 03 (Editar a própria Mensagem), 04 (Apagar a própria Mensagem)

- [ ] **CA1** · No Figma, antes do código: tirar `@canal`, `@aqui` e o agente da lista de menções, e
  trocar "@Admin" por "@admin" em "Menciona você".
- [ ] **CA2** · A tabela `message_mentions` (Mensagem e Pessoa, únicas por par, índice na Pessoa)
  é gravada na transação do envio, com os `@usuário` de Membros extraídos do texto por uma função
  pura, comparados em minúsculas; a edição grava só a diferença, e apagar mantém as Menções da
  Mensagem. O reenvio idempotente não grava Menções.
- [ ] **CA3** · A Mensagem no REST e nos eventos ganha `mentions` (`id` e `username`), carregadas
  por página numa consulta só no histórico.
- [ ] **CA4** · `GET /v1/people` aceita `member_of`: só os Membros da Conversa, com o mesmo texto, a
  mesma ordem e o mesmo limite; quem não é Membro, `conversation_not_found` (404); junto com
  `not_member_of`, 400. A `GET /api/people` do BFF repassa o parâmetro.
- [ ] **CA5** · A lista de menções, na caixa de mensagem e na MessageEditor, segue o padrão combobox
  da spec: abre com `@` no começo ou depois de espaço ou quebra de linha, ou pelo botão `@`; setas,
  Enter ou Tab escolhem; Esc fecha; Enter com a lista aberta não envia nem salva; escolher troca o
  `@texto` por `@usuario ` com o cursor depois do espaço; sem resultado, fecha. A busca descarta
  resposta antiga, e a MentionOption mostra avatar, nome e "@usuário · cargo".
- [ ] **CA6** · O corpo da Mensagem é dividido em texto, link e Menção por uma função pura, com
  Menção só para os `username` em `mentions`. A MentionChip é um botão que abre o Perfil, amarela
  para a própria pessoa e azul para os outros, e a Mensagem que menciona a pessoa logada ganha o tom
  `highlighted`. Uma Menção acrescentada numa edição destaca a Pessoa na hora, pelo `message.updated`.
- [ ] **CA7** · Os testes de ponta a ponta da API provam as Menções de Membros, o `@usuário` de quem
  não é Membro de um Canal privado e o inexistente sem Menção, as maiúsculas, a Menção a si mesma, o
  recálculo na edição, as Menções mantidas ao apagar e a busca com `member_of` (Membros, 404 e 400). O teste de
  unidade prova a extração (começo, depois de pontuação, dentro de e-mail, repetidos). O Vitest
  prova a divisão do corpo, a detecção do `@` e a troca pelo escolhido.
- [ ] **CA8** · O Playwright prova, com duas Pessoas, mencionar só pelo teclado e a outra ver o fundo
  de "Menciona você" e a Menção amarela, clicar na Menção e abrir o Perfil, mencionar na edição, e o
  axe com a lista aberta, sem violações.
- [ ] **CA9** · A validação visual de "Lista de menções" e "Menciona você", nos dois temas, contra
  os frames, fica nesta pasta.
