# 02: Ver um Perfil pelo autor da Mensagem, pela lista de Membros e pelo menu do avatar

**Status:** concluída

**O que construir:** a Pessoa clica no nome ou no avatar de quem escreveu uma Mensagem, ou numa
Pessoa de "Membros de #nome", e o painel de perfil abre ao lado da Conversa, com o avatar grande, o
nome, o cargo, o `@usuário` e, em "Informações de contato", o e-mail e o telefone. O item "Perfil",
no menu do avatar do Rail, abre o próprio Perfil. O botão "Mensagem" aparece, e quem o faz abrir a
Conversa direta é a 04. A hora local é da 03. Referências:
- spec da F05, "Busca e Perfil" ("Perfil"), "Rotas" (`GET /v1/people/:id`), "Módulos", "BFF" e
  "Cliente" ("Painel de perfil", "Onde o Perfil abre" e "Telas");
- PRD, histórias 2 e 3.

**Decisões consumidas de outras tarefas:**
- Colunas e regras de `people` (`username`, `title`, `phone`): 01.

**Bloqueada por:** 01 (@usuário, cargo e telefone pelo comando de contas)

- [x] **CA1** · No Figma, antes do código da tela (`docs/design-system.md`, "Do código para o
  Figma"): um frame do Perfil sem cargo, telefone e hora local, e o item "Perfil" no menu do avatar.
- [x] **CA2** · `GET /v1/people/:id` devolve `id`, `name`, `username`, `title`, `email`, `phone` e
  `time_zone` para qualquer Pessoa com Sessão; id malformado ou inexistente: `person_not_found`
  (404), que entra no catálogo e nos mapas do filter global; sem Sessão, 401.
- [x] **CA3** · A rota do BFF `GET /api/people/:id` repassa o Perfil com as iniciais; 401 leva a
  `GET /api/session/expired`.
- [x] **CA4** · Um provedor cliente no layout das telas logadas guarda a Pessoa do painel, sem mexer
  no endereço, e expõe abrir o Perfil de uma Pessoa. O painel fica no shell, depois da Conversa,
  continua aberto ao trocar de Conversa, troca o conteúdo ao abrir outro Perfil e fecha pelo X ou
  pelo Esc, com o foco voltando ao que o abriu. Abaixo de `xl` sobrepõe a Conversa, e abaixo de
  `sm` ocupa a largura toda.
- [x] **CA5** · O Perfil vem de um `useSWR` por Pessoa, lido de novo a cada abertura, nos estados
  Carregando, Outra pessoa e Próprio perfil (sem "Editar perfil", nem presença, status e selo de
  administrador); 404 mostra "Pessoa não encontrada"; outra falha, "Erro ao carregar", com "Tentar
  de novo". Cargo e telefone que não existem não aparecem. O e-mail abre o programa de e-mail.
- [x] **CA6** · O nome e o avatar do autor no MessageItem viram um botão, com o nome da Pessoa no
  rótulo; a PersonRow de "Membros de #nome" vira um botão que fecha o diálogo e abre o painel; o
  menu do avatar ganha "Perfil", antes de "Sair do Full Cycle".
- [x] **CA7** · Os testes de ponta a ponta da API provam o Perfil completo e sem os campos
  opcionais, o 404 do id malformado e do inexistente e o 401.
- [x] **CA8** · O Playwright prova a abertura pelas três entradas, pelo teclado, o Esc devolvendo o
  foco, a troca de Perfil com o painel aberto e a falha ao carregar pelo `page.route`, e a checagem
  do axe no painel, sem violações.
- [x] **CA9** · A validação visual do painel, nos dois temas, contra os frames "Painel de perfil",
  fica nesta pasta.
