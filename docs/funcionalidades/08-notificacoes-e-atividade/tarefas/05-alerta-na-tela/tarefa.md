# 05: Alerta na tela

**Status:** em andamento

**O que construir:** uma Menção num Canal ou uma Mensagem numa Conversa direta aparece como Alerta
na aba do chat em foco, com o autor, onde foi, o começo do texto e o botão "Abrir", que leva à
Mensagem. Não há Alerta com a Conversa dela aberta e em foco, nas abas sem foco, nem para o que
chegou durante uma queda de conexão. Esta tarefa decide a função pura "para onde vai a
Notificação" (nada, Alerta ou navegador), que a 06 estende. Referências:
- spec da F08, "Tempo real" ("Alerta não é evento") e "Cliente" ("Alerta e notificação do
  navegador" e "Telas");
- spec da F03, "Eventos por Pessoa e reconexão" (o `sync`);
- LLD, "Valores de regra" ("Duração do Alerta");
- design system, "Componentes" (Toast);
- PRD, histórias 1 e 3.

**Decisões consumidas de outras tarefas:**
- O link para a Mensagem: 02.
- A função "esta Mensagem é uma Notificação para mim?": 03.

**Bloqueada por:** 02 (Abrir a Conversa na Mensagem), 03 (Atividade em tempo real)

- [ ] **CA1** · No Figma, antes do código: "Portas / Toast de atividade" com o Alerta acima do
  campo de envio, sem cobri-lo.
- [ ] **CA2** · A função pura de destino tem testes: aba em foco com a Conversa da Mensagem aberta,
  nada; aba em foco com outra tela, Alerta; aba sem foco, nada (o navegador fica para a 06).
- [ ] **CA3** · A aba só alerta depois do `sync` da conexão atual; os eventos reenviados não
  alertam.
- [ ] **CA4** · O Alerta segue o frame, com o título da spec, o começo do texto em até duas linhas
  e "Abrir"; some depois da Duração do Alerta ou pelo botão de fechar, e vários se empilham acima
  do campo de envio.
- [ ] **CA5** · O Alerta é anunciado pelo leitor de tela sem tirar o foco, e "Abrir" e fechar são
  alcançáveis pelo teclado.
- [ ] **CA6** · "Abrir" leva à Mensagem, e a Notificação fica lida.
- [ ] **CA7** · O Playwright prova o Alerta só na aba em foco, nenhum com a Conversa aberta e em
  foco, "Abrir" levando à Mensagem e o rail descendo nas duas abas; e o axe com o Alerta na tela,
  sem violações.
- [ ] **CA8** · A validação visual do Alerta, nos dois temas, contra o frame, fica nesta pasta.
