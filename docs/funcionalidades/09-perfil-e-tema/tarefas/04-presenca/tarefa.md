# 04: Presença

**Status:** em andamento

**O que construir:** a Pessoa se define como ausente ou disponível pelo menu do avatar, e os
outros veem a bolinha de Presença mudar na hora, em todos os lugares da spec. Quem fecha todas as
abas aparece ausente depois da carência, e uma queda curta não muda nada. A escolha vale entre
Sessões e navegadores. Referências:
- spec da F09, "Presença", "Rotas", "Tempo real", "BFF" e "Cliente" ("Escolha de presença",
  "Componentes novos", "Onde aparecem a Presença e o Status" e "Telas");
- LLD, "Estados e regras" ("Presença") e "Valores de regra" ("Carência da presença");
- design system, "Componentes" (PresenceDot, UserAvatar com `Backdrop`);
- PRD, histórias 3 e 4.

**Decisões consumidas de outras tarefas:**
- Sala `workspace` e camada de Pessoas com os componentes de Pessoa: 02.
- Retrato `GET /v1/people/presence` e a leitura dele na conexão e no `sync`: 03.

**Bloqueada por:** 03 (Status)

- [ ] **CA1** · Antes do código, o Figma ganha a bolinha de Presença no autor da Mensagem, em
  "Membros de #nome", nos resultados de "Nova conversa" e no cabeçalho da Conversa direta, nos
  dois temas, se faltar.
- [ ] **CA2** · A migração acrescenta a escolha de presença, com `available` por padrão;
  `PUT /v1/people/me/presence` a grava, recusa valor fora da lista e, com a mesma escolha, não
  publica.
- [ ] **CA3** · O rastreador de presença conta os sockets de cada Pessoa e aplica a carência, com
  a variável `PRESENCE_GRACE_MS` (padrão igual ao do LLD) no schema das variáveis; os testes de
  unidade com timers falsos cobrem primeira conexão, segunda aba, fechar uma de duas, fim da
  carência, reconexão dentro dela e troca de escolha conectada e desconectada.
- [ ] **CA4** · Toda mudança da Presença calculada publica `presence.changed` para a sala
  `workspace`, sem guardar nem reenviar; a Presença vai no retrato, no Perfil, na busca e nos
  Membros, e a escolha em `GET /v1/sessions/current`.
- [ ] **CA5** · O menu do avatar mostra a Presença no cabeçalho e "Definir como ausente" ou
  "Definir como disponível"; a escolha muda na hora e volta ao anterior com toast de erro na
  falha.
- [ ] **CA6** · A bolinha aparece no UserAvatar em todos os lugares da spec, cheia para
  disponível e vazada para ausente, com texto para leitor de tela; a camada aplica
  `presence.changed` e o retrato em funções puras testadas.
- [ ] **CA7** · O Playwright, com a carência reduzida no ambiente de teste, prova "Definir como
  ausente" visto pela outra Pessoa sem recarregar e a Pessoa ausente depois de fechar o contexto;
  tudo pelo teclado; e o axe no menu, sem violações.
- [ ] **CA8** · A validação visual de "Casca / Menu do usuário" (Disponível e Ausente), do painel
  de perfil e dos frames novos, nos dois temas, fica nesta pasta, e o roteiro do Lighthouse com
  nota 100 na Conversa com o painel de perfil aberto e com o diálogo aberto, nos dois temas,
  também.
