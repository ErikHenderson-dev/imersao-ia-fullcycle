# 02: Ver, concluir e reabrir Tarefas em Atividade → Tarefas

**Status:** em andamento

**O que construir:** a Pessoa abre Atividade → Tarefas e vê as Tarefas recebidas e as delegadas,
com as abertas primeiro. O Responsável conclui e reabre as recebidas, e a mudança aparece na hora
em todas as abas dele e de quem delegou, inclusive depois de uma queda de conexão. Uma Tarefa com o
Pedido apagado continua na aba, e a aba vazia explica como pedir uma Tarefa ao Agente. Referências:
- spec da F12, "Concluir, reabrir e listar", "Eventos" e "Cliente" ("Abas", "Aba Tarefas",
  "Destaque", "Rotas do BFF" e "Figma");
- LLD, "Estados e regras" (6.1) e "Cliente" (`/atividade`);
- PRD, histórias 5 e 6 (estado das delegadas).

**Decisões consumidas de outras tarefas:**
- Schema de `tasks` e formato da Tarefa no payload: 01.

**Bloqueada por:** 01

- [ ] **CA1** · `GET /v1/tasks?role=assigned|delegated` lista com as `open` primeiro e as mais novas
  primeiro, paginada por cursor em `(status, id)`; uma Tarefa delegada a si mesmo aparece nas duas;
  `GET /v1/tasks/:id` devolve uma Tarefa ao Responsável ou a quem delegou.
- [ ] **CA2** · `POST /v1/tasks/:id/complete` e `/reopen` mudam o estado só pelo Responsável, com a
  linha travada; repetidos, respondem 200 sem mudar nada nem publicar; quem delegou recebe
  `task_not_assignee` (403) e um terceiro, `task_not_found` (404).
- [ ] **CA3** · `task.created` (da ação `task`) e `task.updated` saem como eventos guardados por
  Pessoa ao Responsável e a quem delegou, e são reenviados na reconexão.
- [ ] **CA4** · A Tarefa no payload traz `trigger_message.deleted`, e com o Pedido apagado o link
  leva à Conversa e a Tarefa mostra que a Mensagem foi apagada.
- [ ] **CA5** · A aba Tarefas entra em `ACTIVITY_TABS`, com os grupos Recebidas e Delegadas, os
  botões "Concluir" e "Reabrir" com atualização otimista desfeita no erro, a atualização por evento
  e por `sync`, e o estado vazio.
- [ ] **CA6** · `?aba=tarefas&tarefa=<id>` rola até a Tarefa, dá foco a ela e a destaca, buscando-a
  por `GET /v1/tasks/:id` quando não está na primeira página.
- [ ] **CA7** · O Figma é conferido e completado antes do código com os frames da aba Tarefas
  (grupos, Tarefa aberta e concluída, Pedido apagado, aba vazia), nos dois temas.
- [ ] **CA8** · Testes de ponta a ponta da API do chat cobrem CA1 a CA4, o Vitest cobre a mesclagem
  e a ordenação por evento, e o Playwright cobre as listas, concluir e reabrir em duas Pessoas, o
  Pedido apagado, a aba vazia e o teclado, com o bot agindo pela rota `/v1/bot/.../task`.
- [ ] **CA9** · O LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
