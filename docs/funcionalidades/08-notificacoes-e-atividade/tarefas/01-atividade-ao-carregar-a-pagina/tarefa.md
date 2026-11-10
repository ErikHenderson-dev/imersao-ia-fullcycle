# 01: Atividade ao carregar a página

**Status:** concluída

**O que construir:** o rail ganha o ícone Atividade, com o número de Notificações não lidas, e ele
abre a tela Atividade, com as abas Todas, Menções e Mensagens diretas, cada uma com o seu contador.
A lista mostra as Notificações da mais nova para a mais antiga, lidas e não lidas, e carrega as
mais antigas ao rolar. Clicar num item abre a Conversa dele. Esta tarefa decide a função de
Notificações da API (fontes, lida pela Última leitura, números com teto), o contrato de
`GET /v1/activity` e `GET /v1/activity/unread` e os tipos da web, que a 03 e a 04 reaproveitam. A
marca de "Marcar tudo como lido" fica para a 04, e o tempo real para a 03: aqui, tudo muda ao
recarregar. Referências:
- spec da F08, "Notificações e contagem", "Rotas", "BFF" e "Cliente" ("Números de Atividade",
  "Tela Atividade", "Rail", "Componentes novos" e "Telas");
- ADR 0027; LLD, "Concorrência e idempotência" ("Notificações") e "Valores de regra" ("Teto da
  contagem de não lidas");
- design system, "Estados" (Não lido) e "Componentes" (NotificationItem, TabsTrigger, CountBadge);
- PRD, histórias 4 e 5.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [x] **CA1** · `GET /v1/activity` traz as Menções à Pessoa em Canais de que ela é Membro e as
  Mensagens de outros nas Conversas diretas dela, filtradas por `kind`, com keyset e `has_more`.
  Não traz as próprias Mensagens, a Menção a si mesma, a Conversa direta consigo mesma, as
  apagadas, a Menção dentro de Conversa direta como item de Menção, nem as de um Canal privado de
  que a Pessoa foi removida. A edição que acrescenta a Menção cria o item, e a que tira o remove.
- [x] **CA2** · `GET /v1/activity/unread` conta só as Notificações posteriores à Última leitura da
  Conversa, por tipo e no total, cada número parando no teto; ler a Conversa zera as dela.
- [x] **CA3** · As rotas do BFF e os serviços do RSC levam a lista e os números à web, com 401 para
  `GET /api/session/expired`.
- [x] **CA4** · O rail mostra o link Atividade abaixo do Início, ativo em `/atividade`, com o
  CountBadge do total e o nome acessível "Atividade, N não lidas" (só "Atividade" em zero).
- [x] **CA5** · `/atividade` mostra as três abas, sem Tarefas, com a aba na query e o contador de
  cada uma; a lista vem do RSC e carrega as páginas anteriores ao rolar até `has_more` falso.
- [x] **CA6** · O NotificationItem mostra o autor, onde foi, o começo do texto e o tempo relativo;
  a não lida tem o estado Não lido do design system, calculado no cliente pela Última leitura da
  lista de Conversas. O item é um botão com o nome acessível da spec, e Enter abre a Conversa.
- [x] **CA7** · Carregando, erro com "Tentar de novo" e vazio de cada aba seguem os frames.
- [x] **CA8** · O Playwright prova a Menção e a Mensagem direta nas abas certas, com os contadores,
  depois de recarregar; o marcador do Início da F07 na tela Atividade; tudo pelo teclado; e o axe
  na tela Atividade com itens lidos e não lidos, sem violações.
- [ ] **CA9** · A validação visual dos frames de Atividade e de "Casca / Rail / Atividade ativa",
  nos dois temas, fica nesta pasta, e o roteiro do Lighthouse com nota 100 na tela Atividade
  também.
