# 03: Notificações de Tarefa

**Status:** em andamento

**O que construir:** o Responsável é notificado quando recebe uma Tarefa, e quem delegou, quando
ela é concluída ou reaberta, com Alerta na tela ou notificação do navegador, como na F08. As
Notificações de Tarefa aparecem na aba Todas e no contador do rail; clicar numa delas a marca como
lida e abre a aba Tarefas com a Tarefa em destaque, e "marcar tudo como lido" também as lê.
Ninguém é notificado de uma ação própria. Referências:
- spec da F12, "Tarefa" (`task_notifications`), "Atividade", "Eventos" e "Cliente" ("Notificação de
  Tarefa" e "Alerta");
- [ADR 0029](../../../../adr/0029-notificacoes-de-tarefa-gravadas.md) e ADR 0027;
- PRD, histórias 4 e 6, e "Notificações de Tarefa".

**Decisões consumidas de outras tarefas:**
- Schema de `tasks` e formato da Tarefa no payload: 01.
- Eventos `task.created` e `task.updated`, destaque por `?tarefa=` e erros de Tarefa: 02.

**Bloqueada por:** 02

- [ ] **CA1** · A tabela `task_notifications` existe; `received` é gravada na transação da ação
  `task`, e `completed` e `reopened` na transação da mudança de estado, nunca para quem agiu.
- [ ] **CA2** · A consulta de Atividade ganha a fonte `task`: a aba Todas traz os itens de Tarefa
  pelo mesmo keyset, e `GET /v1/activity/unread` e `activity.unread` ganham `task_count`, somado ao
  `total_count` com o teto de 100.
- [ ] **CA3** · `PUT /v1/activity/task-notifications/:id/read` marca como lida só para o
  destinatário (204, também se já lida); `PUT /v1/activity/read` aceita `task_notification_id`.
- [ ] **CA4** · `task.created` e `task.updated` levam `notification` com a Notificação de quem
  recebe, ou nula para quem agiu.
- [ ] **CA5** · A web mostra os títulos "{nome} delegou uma Tarefa a você", "{nome} concluiu uma
  Tarefa" e "{nome} reabriu uma Tarefa" na lista, no Alerta e na notificação do navegador; o clique
  marca como lida e abre a aba Tarefas com a Tarefa em destaque.
- [ ] **CA6** · A central de alertas decide o destino dos eventos de Tarefa pelas regras da F08, sem
  Alerta com a aba Tarefas aberta e em foco nem nos eventos reenviados da reconexão.
- [ ] **CA7** · O Figma ganha a Notificação de Tarefa na lista e no Alerta, nos dois temas, antes do
  código.
- [ ] **CA8** · Testes de ponta a ponta da API do chat (HTTP e socket) cobrem CA1 a CA4, inclusive
  duas conclusões simultâneas com uma Notificação só; o Vitest cobre o título, a leitura e a decisão
  de Alerta; o Playwright cobre o Alerta ao Responsável e a quem delegou e o clique que abre a
  Tarefa.
- [ ] **CA9** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
