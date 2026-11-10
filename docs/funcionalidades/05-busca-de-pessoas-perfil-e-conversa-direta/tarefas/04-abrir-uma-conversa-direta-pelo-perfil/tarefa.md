# 04: Abrir uma Conversa direta pelo Perfil

**Status:** em andamento

**O que construir:** a Pessoa clica em "Mensagem" no Perfil de alguém, ou no próprio, e a Conversa
direta abre, com o foco na caixa de mensagem, e entra na seção "Mensagens diretas" da barra
lateral, em todas as abas dela. Abrir de novo cai na mesma Conversa, com o histórico. O cabeçalho
mostra a outra Pessoa e abre o Perfil dela. A Conversa consigo mesma aparece com "você". A outra
Pessoa ainda não vê nada: ela recebe a Conversa na primeira Mensagem, na 05. Referências:
- spec da F05, "Conversa direta", "Rotas" (`POST /v1/conversations`), "Módulos", "Tempo real",
  "BFF" (`openDirectConversation`) e "Cliente" ("Lista de Conversas e barra lateral", "Painel de
  perfil", "Conversa direta" e "Telas");
- LLD, "Concorrência e idempotência" ("Abrir Conversa direta");
- [ADR 0025](../../../../adr/0025-membro-da-conversa-direta-na-primeira-mensagem.md);
- PRD, histórias 4, 5 e 6.

**Decisões consumidas de outras tarefas:**
- Provedor e painel de perfil, com o botão "Mensagem": 02.

**Bloqueada por:** 02 (Ver um Perfil pelo autor da Mensagem, pela lista de Membros e pelo menu do
avatar)

- [ ] **CA1** · No Figma, antes do código das telas: corrigir o texto de "Conversa / Lista / Início
  da conversa direta", criar o começo da Conversa consigo mesma e a falha ao abrir a Conversa
  direta no painel.
- [ ] **CA2** · `conversations` aceita o `kind` `direct`, com `name` e `topic` nulos e
  `direct_person_low_id` e `direct_person_high_id` (`low <= high`, a mesma Pessoa na Conversa
  consigo mesma) por `CHECK`, e unicidade parcial no par, numa migração escrita à mão para os
  `CHECK`.
- [ ] **CA3** · `POST /v1/conversations` com `kind: "direct"` e `person_id`, sem `client_id`,
  `name` nem `topic`, abre pela ordem da spec: Pessoa inexistente, `person_not_found` (404); grava
  a Conversa do par e a participação só de quem abriu, tolerando as que já existem; 201 quando
  criada agora, 200 quando já existia. As duas pontas ao mesmo tempo dão numa Conversa só. A
  entrada dos Canais continua a da F04.
- [ ] **CA4** · Toda Conversa no REST e na `ConversationPayload` do `chat-events` ganha
  `counterpart` (`id`, `name`, `username`; a própria Pessoa na Conversa consigo mesma; nulo nos
  Canais), e o `kind` `direct`. A lista de Conversas traz os Canais primeiro e depois as Conversas
  diretas, pela ordem alfabética aplicada ao `counterpart.name`, na API e na cópia da web.
- [ ] **CA5** · Quem passou a ser Membro agora recebe `conversation.member_added` nas outras abas,
  com `person_ids` dela; quem já era Membro, nada. Adicionar Membros a uma Conversa direta:
  `members_not_editable` (409).
- [ ] **CA6** · O Server Action `openDirectConversation` devolve a Conversa no `ok`, insere-a na
  lista do cliente se ainda não estiver lá e leva a `/conversas/<id>`; o `member_added` da própria
  abertura é ignorado pelo id repetido. O botão "Mensagem" fica em "Abrindo" e não aceita outro
  clique; na falha, o erro fica no painel, abaixo do botão, que tenta de novo.
- [ ] **CA7** · A seção "Mensagens diretas", abaixo de "Canais", lista as Conversas diretas com o
  avatar e o nome do `counterpart` e "você" ao lado da Conversa consigo mesma. A Conversa direta tem
  o cabeçalho com o avatar e o nome do `counterpart`, como um botão que abre o Perfil, sem Tópico nem
  botão de Membros; o começo da conversa nas duas variantes; e "Mensagem para <primeiro nome>", ou
  "Mensagem para você". Sem última Conversa e sem Canal, a Home abre a primeira Conversa direta.
- [ ] **CA8** · Os testes de ponta a ponta da API provam a criação com um Membro, a reabertura com
  200, as duas pontas ao mesmo tempo, a Conversa consigo mesma, o 404 da Pessoa inexistente, o 400
  da entrada de Canal, o 409 da adição, o 404 para quem não é Membro e a ordem da lista. Os de
  tempo real provam o `member_added` nas outras abas de quem abriu e nada para a outra Pessoa. O
  Vitest prova a ordem e a inserção com o `counterpart`.
- [ ] **CA9** · O Playwright prova abrir pelo "Mensagem" e reabrir na mesma Conversa, a Conversa
  consigo mesma com "você", o Perfil pelo cabeçalho, a Conversa aparecendo em outra aba sem
  recarregar e a falha ao abrir pelo `page.route`, pelo teclado, e a checagem do axe na Conversa
  direta, sem violações.
- [ ] **CA10** · A validação visual da Conversa direta e da barra lateral, nos dois temas, contra os
  frames, fica nesta pasta.
