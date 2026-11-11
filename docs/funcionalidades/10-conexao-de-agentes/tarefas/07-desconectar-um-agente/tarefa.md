# 07: Desconectar um Agente

**Status:** em andamento

**O que construir:** o administrador desconecta um Agente pelo diálogo. A confirmação "Desconectar
<nome>?" explica que ninguém mais vai conseguir mencioná-lo, que as Mensagens dele continuam e que
ele pode ser conectado de novo. Confirmar mostra "Enviando", e o Agente some da barra lateral.
"Cancelar" ou Esc não mudam nada, e uma falha mantém o Agente conectado e mostra o erro. Com o
diálogo completo nas duas visões, esta tarefa faz também o roteiro manual do Lighthouse.
Referências:
- spec da F10, "Registro de Agentes" (desconectar idempotente), "Rotas e credencial", "BFF",
  "Cliente" ("Diálogo Agentes" e "Telas") e "Decisões de teste" ("Roteiro manual");
- frames "Diálogos / Desconectar agente" (Padrão e Enviando);
- design system, "Componentes" (ConfirmDialog);
- PRD, história 2.

**Decisões consumidas de outras tarefas:**
- Base de testes do Serviço de agentes: 04.
- Cache do SWR da lista e e2e com o Serviço de agentes: 05.
- Padrão da rota de conexão, ordem das conferências e união de resultado da Server Action: 06.

**Bloqueada por:** 06 (Conectar um Agente)

- [ ] **CA1** · Antes do código, o Figma ganha o erro ao desconectar, nos dois temas.
- [ ] **CA2** · `DELETE /v1/agents/:slug/connection` responde 204, inclusive repetido, com os
  mesmos erros e a mesma ordem do `PUT`; os testes de integração cobrem os casos.
- [ ] **CA3** · `disconnectAgent` segue a `connectAgent`: Pessoa sem cache, `forbidden` sem chamar o
  Serviço de agentes e `failure` para qualquer falha dele.
- [ ] **CA4** · "Desconectar" abre o ConfirmDialog com o foco em "Cancelar"; Esc ou "Cancelar"
  fecham sem mudar nada; confirmar mostra "Enviando", fecha e mostra o Agente desconectado no
  diálogo e fora da barra lateral; a falha fecha a confirmação e mostra o toast de erro.
- [ ] **CA5** · O Playwright prova o administrador desconectando pelo teclado, as Mensagens antigas
  do Agente ainda visíveis, e a outra Pessoa sem a linha ao recarregar; o axe na confirmação, nos
  dois temas, sem violações.
- [ ] **CA6** · A validação visual dos frames "Diálogos / Desconectar agente", nos dois temas, fica
  nesta pasta.
- [ ] **CA7** · O roteiro manual, feito por uma pessoa e registrado nesta pasta, tem a nota 100 de
  Acessibilidade do Lighthouse nos dois temas, com o diálogo "Agentes" aberto como administrador e
  como quem não administra.
