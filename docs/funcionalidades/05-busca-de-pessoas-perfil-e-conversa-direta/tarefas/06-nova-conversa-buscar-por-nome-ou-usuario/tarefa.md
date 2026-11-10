# 06: "Nova conversa": buscar por nome ou @usuário

**Status:** concluída

**O que construir:** a Pessoa clica em "Nova conversa", busca qualquer Pessoa do workspace por nome
ou `@usuário`, vê o `@usuário` e o cargo de cada uma, escolhe uma pelo mouse ou pelas setas e
Enter, e a Conversa direta abre. O passo "Adicionar pessoas" da F04 passa a buscar do mesmo jeito.
Referências:
- spec da F05, "Busca e Perfil" ("Busca" e "Pessoa nas listas"), "Rotas" (`GET /v1/people` e
  `GET /v1/conversations/:id/members`), "BFF" e "Cliente" ("Busca de Pessoas" e "Telas");
- PRD, histórias 1 e 6.

**Decisões consumidas de outras tarefas:**
- Coluna `username` e cargo de `people`: 01.
- `openDirectConversation` e a seção "Mensagens diretas": 04.

**Bloqueada por:** 01 (@usuário, cargo e telefone pelo comando de contas), 04 (Abrir uma Conversa
direta pelo Perfil)

- [x] **CA1** · No Figma, antes do código das telas: a falha ao abrir a Conversa direta no diálogo
  "Nova conversa", e "@usuário · cargo" nas PersonRows do passo "Adicionar pessoas".
- [x] **CA2** · `GET /v1/people` acha o texto no nome ou no `username`, sem diferenciar maiúsculas,
  minúsculas e acentos, e ignora um `@` no começo. O `not_member_of` passa a ser opcional: sem ele,
  ninguém fica de fora, inclusive quem busca; com ele, continua como na F04. O limite e a ordem são
  os da F04. A `GET /api/people` do BFF aceita a busca sem `not_member_of`.
- [x] **CA3** · Cada Pessoa da busca e de `GET /v1/conversations/:id/members` ganha `username` e
  `title`.
- [x] **CA4** · Um componente de busca só, no padrão combobox (o foco no campo, as setas mudam a
  Pessoa destacada por `aria-activedescendant`, Enter a escolhe), com a espera e o descarte de
  resposta antiga da F04, serve ao "Nova conversa" e ao "Adicionar pessoas". A PersonRow mostra
  "@usuário · cargo", sem o cargo quando ele não existe, e "(você)" ao lado da própria pessoa.
- [x] **CA5** · A SidebarAction "Nova conversa", no fim de "Mensagens diretas", abre o diálogo com o
  foco na busca, nos estados Carregando, Lista, Ninguém encontrado (com o texto buscado) e Abrindo.
  Escolher uma Pessoa chama `openDirectConversation`; o diálogo fecha ao abrir a Conversa e, na
  falha, fica aberto com o erro e permite tentar de novo. Esc fecha e devolve o foco.
- [x] **CA6** · Os testes de ponta a ponta da API provam a busca pelo `@usuário`, com e sem o `@`,
  pelo nome sem acento, sem `not_member_of` incluindo quem busca, com ele como na F04, e o
  `username` e o `title` nas Pessoas da busca e dos Membros.
- [x] **CA7** · O Playwright prova buscar a outra Pessoa pelo `@usuário`, escolher pelas setas e
  Enter e cair na Conversa direta; a própria pessoa com "(você)", abrindo a Conversa consigo mesma;
  "Ninguém encontrado"; a falha ao abrir pelo `page.route`; o "Adicionar pessoas" achando pelo
  `@usuário`; e a checagem do axe no diálogo, sem violações.
- [x] **CA8** · A validação visual do diálogo "Nova conversa", nos dois temas, contra os frames,
  fica nesta pasta, e o roteiro manual do Lighthouse (nota 100 de Acessibilidade) com o diálogo, o
  painel de perfil e a Conversa direta também.
