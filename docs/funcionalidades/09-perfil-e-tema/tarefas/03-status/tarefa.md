# 03: Status

**Status:** em andamento

**O que construir:** no diálogo "Editar perfil", a Pessoa escolhe um dos sete emojis e escreve a
mensagem de Status, ou limpa os dois. Para os outros, o emoji aparece ao lado do nome dela em
todos os lugares da spec, com a mensagem no Tooltip e no nome acessível, e o painel de perfil
mostra o Status por inteiro, tudo sem recarregar. Esta tarefa cria o retrato
`GET /v1/people/presence`, que aqui traz só o Status e que a 04 estende com a Presença.
Referências:
- spec da F09, "Pessoas", "Rotas", "Tempo real", "BFF" e "Cliente" ("Camada de Pessoas",
  "Componentes novos", "Onde aparecem a Presença e o Status", "Editar perfil" e "Telas");
- LLD, "Valores de regra" ("Tamanho do texto do Status" e "Emojis do Status");
- design system, "Componentes" (UserStatus, Tooltip);
- PRD, histórias 2 e 4.

**Decisões consumidas de outras tarefas:**
- Contrato de `PATCH /v1/people/me` e regras dos campos: 01.
- Sala `workspace`, `person.updated` e camada de Pessoas com os componentes de Pessoa: 02.

**Bloqueada por:** 02 (Perfil em tempo real)

- [ ] **CA1** · Antes do código, o Figma ganha o emoji de Status no autor da Mensagem, em
  "Membros de #nome", nos resultados de "Nova conversa" e no cabeçalho da Conversa direta, o
  painel de perfil com o texto do Status e o diálogo com o Status limpo, nos dois temas; o
  sétimo emoji do diálogo é conferido no frame e registrado no LLD.
- [ ] **CA2** · A migração acrescenta o emoji e o texto do Status com os CHECKs; o
  `PATCH /v1/people/me` aceita os dois, grava `speech` no texto sem emoji, limpa o Status com os
  dois nulos e recusa texto acima de 100, com quebra de linha ou chave fora das sete.
- [ ] **CA3** · O Status vai no `person.updated`, em `GET /v1/sessions/current`, no Perfil, na
  busca e nos Membros; `GET /v1/people/presence` devolve só quem tem Status, e o BFF o expõe em
  `GET /api/people/presence`.
- [ ] **CA4** · A camada de Pessoas lê o retrato na conexão e a cada `sync`, e quem não está nele
  fica sem Status.
- [ ] **CA5** · O diálogo ganha o grupo de rádio dos sete emojis, pelas setas, com Enter ou
  espaço no marcado desmarcando, e a "Mensagem de status"; as regras novas entram no módulo
  compartilhado e no "Erro de campo".
- [ ] **CA6** · O UserStatus aparece em todos os lugares da spec, e não no Alerta nem na
  Atividade; o painel de perfil mostra o emoji e a mensagem por inteiro.
- [ ] **CA7** · O Playwright prova o Status definido por uma Pessoa visto pela outra sem
  recarregar, com a mensagem no Tooltip, e o Status limpo sumindo; tudo pelo teclado; e o axe no
  diálogo e no painel, sem violações.
- [ ] **CA8** · A validação visual do diálogo com Status e dos frames novos, nos dois temas, fica
  nesta pasta.
