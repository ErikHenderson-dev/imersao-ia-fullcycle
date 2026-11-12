# 01: Ação da barra lateral compartilhada

**Status:** concluída

**O que construir:** refatoração prévia, sem mudança visível. As ações das seções da barra
lateral ("Adicionar canal" e "Nova conversa") passam a ser um componente `SidebarAction` só, com
as variantes que o design system define para a seção Agentes (`connect`, `add`, `manage` e
`view`), prontas para a 05 e a 06 usarem. A barra lateral continua igual nos dois temas e em
telas estreitas. Esta tarefa decide a API do componente (variante, rótulo, ícone, contador e
ação). Referências:
- spec da F10, "Cliente" ("Seção Agentes da barra lateral");
- design system, "Comportamentos registrados no Figma" (SidebarAction, SidebarRow, CountBadge);
- frames "Casca / Agentes" do Figma.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [x] **CA1** · O `SidebarAction` existe com as variantes `connect`, `add`, `manage` e `view`, o
  rótulo, o ícone e o CountBadge opcional, como o componente do Figma, e funciona por teclado.
- [x] **CA2** · "Adicionar canal" e "Nova conversa" usam o componente, com a mesma aparência e o
  mesmo comportamento de antes, nos dois temas e na gaveta abaixo de 768 px.
- [x] **CA3** · Os testes de ponta a ponta que já cobrem criar Canal e abrir Conversa direta pela
  barra lateral continuam passando sem mudança.
