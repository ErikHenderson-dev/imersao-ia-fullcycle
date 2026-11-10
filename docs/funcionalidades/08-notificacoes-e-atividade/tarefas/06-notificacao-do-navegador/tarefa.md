# 06: Notificação do navegador

**Status:** a fazer

**O que construir:** a Pessoa liga a notificação do navegador pelo menu da conta, e a permissão só
é pedida aí. Com a opção ligada e nenhuma aba do chat em foco, cada Notificação sai uma vez como
notificação do navegador, mesmo com várias abas abertas, e o clique traz o chat para a frente na
Mensagem. A opção vale por navegador e mostra quando está bloqueada. Referências:
- spec da F08, "Cliente" ("Alerta e notificação do navegador" e "Opção do navegador") e "Telas"
  ("Casca / Menu do usuário");
- LLD, "Cliente" ("Notificação do navegador");
- PRD, histórias 2 e 3.

**Decisões consumidas de outras tarefas:**
- A função "esta Mensagem é uma Notificação para mim?": 03.
- A função pura de destino da Notificação, que esta tarefa estende: 05.
- O link para a Mensagem: 02.

**Bloqueada por:** 05 (Alerta na tela)

- [ ] **CA1** · O menu da conta mostra "Ativar notificações do navegador", "Desativar notificações
  do navegador" e "Bloqueadas neste navegador" conforme a permissão e a opção guardada no
  navegador; ativar com a permissão ainda não pedida a pede, e só aí; sem a API de notificação, o
  item não aparece. O estado sai de uma função pura com teste.
- [ ] **CA2** · As abas de um navegador trocam o próprio foco e sabem se alguma está em foco,
  inclusive quando uma abre ou fecha.
- [ ] **CA3** · A função de destino passa a mandar ao navegador quando nenhuma aba está em foco e
  a opção está ligada com a permissão dada; os testes cobrem os casos.
- [ ] **CA4** · Todas as abas criam a notificação com o mesmo identificador da Mensagem, e o
  navegador mostra uma só; com uma aba em foco, ou a opção desligada, não sai nenhuma.
- [ ] **CA5** · O clique traz para a frente a aba que criou a notificação e abre a Mensagem.
- [ ] **CA6** · O Playwright prova, com a permissão concedida pelo contexto e uma notificação
  instrumentada, uma notificação só sem aba em foco e nenhuma com aba em foco; e o estado
  "Bloqueadas" com a permissão negada.
- [ ] **CA7** · A validação visual dos três estados do menu, nos dois temas, e o roteiro manual
  com a notificação de verdade no Chrome, com o chat em segundo plano e o clique trazendo a aba,
  ficam nesta pasta.
