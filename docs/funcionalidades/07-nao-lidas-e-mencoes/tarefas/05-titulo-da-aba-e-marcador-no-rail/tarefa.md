# 05: Título da aba e marcador no rail

**Status:** a fazer

**O que construir:** o título da aba do navegador começa com a soma dos contadores visíveis da
barra lateral, como "(3) Full Cycle Chat", e o ícone Início do rail ganha um marcador quando há ao
menos uma Conversa Não lida, também na tela Atividade. A Conversa aberta com a aba em foco não
entra em nenhum dos dois. Referências:
- spec da F07, "Cliente" ("Título da aba e rail" e "Telas");
- design system, "Componentes" (Rail);
- PRD, história 4.

**Decisões consumidas de outras tarefas:**
- Os números na lista de Conversas: 01.
- A regra de exibição da Conversa aberta em foco: 02.

**Bloqueada por:** 02 (Ler a Conversa)

- [ ] **CA1** · No Figma, antes do código: criar o marcador de Não lidas no ícone Início, em
  "Casca / Rail / Início ativo" e "Casca / Rail / Atividade ativa".
- [ ] **CA2** · O título mostra a soma das Menções dos Canais e das Não lidas das Conversas
  diretas, sem a Conversa aberta em foco, com `(99+)` acima de 99 e sem número em zero, e é
  reaplicado a cada navegação; a soma é uma função pura com teste.
- [ ] **CA3** · O Início ganha o ponto na cor `badge` com ao menos uma Conversa Não lida, fora a
  aberta em foco, e o rótulo acessível passa a avisar as Não lidas.
- [ ] **CA4** · O Playwright prova o título com "(1)" e o marcador no Início depois de uma Menção
  em outra Conversa, também na tela Atividade, e os dois sumindo ao ler.
- [ ] **CA5** · A validação visual do rail com o marcador, nos dois temas, contra os frames, fica
  nesta pasta.
