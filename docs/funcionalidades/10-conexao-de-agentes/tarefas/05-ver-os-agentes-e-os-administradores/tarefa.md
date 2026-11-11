# 05: Ver os Agentes e os administradores

**Status:** a fazer

**O que construir:** quem não administra vê a seção Agentes na barra lateral, com "Ver agentes", e
abre o diálogo "Agentes". O diálogo mostra cada Agente com o estado, explica que só
administradores conectam e lista os administradores, cujo perfil abre com um clique ou Enter. Se o
Serviço de agentes estiver fora, a seção continua visível, o diálogo mostra o erro e o resto do
chat funciona. Esta tarefa decide:
- o cliente do Serviço de agentes no BFF e o `GET /api/agents`;
- o tipo `Agent` da web;
- o cache do SWR da lista, com a chave e os pontos de releitura;
- o filtro `GET /v1/people?admin=true`;
- a função que escolhe a variante da seção, com a `view` e a lista indisponível;
- o e2e com o Serviço de agentes de pé.

Referências:
- spec da F10, "Papel de administrador" (filtro), "BFF", "Cliente" ("Lista de Agentes no cliente",
  "Seção Agentes da barra lateral", "Diálogo Agentes" e "Telas") e "Ambiente de desenvolvimento";
- frames "Casca / Agentes / Quem não administra" e "Diálogos / Agentes" (Carregando, Erro, Vazio,
  Membro sem conectados, Membro com conectado, Membro sem administradores);
- design system, "Componentes" (Dialog, AgentAvatar, UserAvatar, EmptyState);
- PRD, história 3 e "Erros e Serviço de agentes fora".

**Decisões consumidas de outras tarefas:**
- API e variantes do `SidebarAction`: 01.
- `is_admin` na Sessão e no Perfil, `isAdmin` na web e o `set-admin`: 02.
- Contrato de `GET /v1/agents`, Bearer e segredo de desenvolvimento: 04.

**Bloqueada por:** 01 (Ação da barra lateral compartilhada), 02 (Papel de administrador e selo no
perfil), 04 (Catálogo do Serviço de agentes com credencial)

- [ ] **CA1** · Antes do código, o Figma ganha a seção Agentes com a lista indisponível e o frame do
  selo alinhado aos frames "Casca / Agentes" na linha do Agente e na ação da seção, nos dois temas.
- [ ] **CA2** · `GET /v1/people?admin=true` traz só os administradores, com e sem `q`, em ordem de
  nome, até o limite da busca de Pessoas.
- [ ] **CA3** · O BFF lê o Serviço de agentes com `AGENTS_SERVICE_URL` e `AGENTS_SERVICE_TOKEN`, do
  schema de variáveis da web e do `compose.yaml`; `GET /api/agents` exige Sessão e responde 502
  com `agents_unavailable` quando o Serviço de agentes falha.
- [ ] **CA4** · O layout logado lê a lista no servidor e carrega mesmo com o Serviço de agentes
  fora; a seção Agentes mostra os conectados e "Ver agentes", ou só "Ver agentes" com a lista
  indisponível.
- [ ] **CA5** · O diálogo revalida ao abrir e mostra Carregando, Erro com "Tentar de novo", Vazio e
  a lista com o estado, sem botões; os administradores vêm de `GET /api/people?admin=true`, com
  avatar, Presença, nome, `@usuário` e cargo, e abrem o painel de perfil fechando o diálogo; sem
  administradores, mostra o texto de "Membro sem administradores".
- [ ] **CA6** · O e2e passa a exigir o Serviço de agentes de pé, e o Playwright prova o diálogo de
  quem não administra com a lista de administradores e a abertura do perfil, tudo pelo teclado, e
  o axe no diálogo, nos dois temas, sem violações.
- [ ] **CA7** · O Vitest cobre a escolha da variante da seção para quem não administra e para a
  lista indisponível.
- [ ] **CA8** · A validação visual dos frames de quem não administra, nos dois temas, fica nesta
  pasta.
