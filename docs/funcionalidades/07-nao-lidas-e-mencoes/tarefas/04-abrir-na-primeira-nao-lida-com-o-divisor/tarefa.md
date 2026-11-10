# 04: Abrir na primeira Não lida, com o divisor

**Status:** concluída

**O que construir:** ao abrir uma Conversa com Não lidas, ela começa na primeira delas, com o
divisor "Novas mensagens" logo acima; se a primeira Não lida não está carregada, a Conversa vai
até ela, no estado "Indo até a mensagem". O divisor fica no lugar enquanto a pessoa continua na
Conversa e, ao voltar o foco da aba, passa para cima da primeira Mensagem que chegou sem foco.
Referências:
- spec da F07, "Cliente" ("Abrir na primeira Não lida e o divisor", "Componentes novos" e
  "Telas");
- spec da F06, "Cliente" ("Ir até a Mensagem citada");
- design system, "Componentes" (UnreadDivider);
- PRD, história 3.

**Decisões consumidas de outras tarefas:**
- A Última leitura na lista de Conversas: 01.
- O foco da aba: 02.

**Bloqueada por:** 02 (Ler a Conversa)

- [x] **CA1** · O UnreadDivider entra como no frame "Conversa / Lista / Divisor de novas
  mensagens".
- [x] **CA2** · Ao abrir, o cliente guarda a Última leitura daquele momento; o divisor fica acima
  da primeira Mensagem de outro autor posterior a ela e não se move com as Mensagens que chegam com
  a aba em foco; trocar de Conversa e voltar recalcula, sem divisor sem Não lidas; a primeira Não
  lida apagada leva o divisor para a seguinte.
- [x] **CA3** · Se a primeira Não lida cabe na tela com o fim da lista, a Conversa abre no fim; se
  não cabe, rola até ela; se não está carregada, usa a ida da F06-T07 até a página que a contém ou
  começa antes dela, e até o começo do histórico com a Última leitura nula.
- [x] **CA4** · Ao voltar o foco com a Conversa aberta, o cliente guarda de novo a Última leitura
  antes de informar a leitura, e a rolagem não muda.
- [x] **CA5** · A primeira Não lida, o lugar do divisor e a decisão de abrir no fim, rolar ou ir
  até ela são funções puras com teste.
- [x] **CA6** · O Playwright prova abrir uma Conversa com mais Não lidas que uma página e chegar à
  primeira, com o divisor acima, e o axe com o divisor, sem violações.
- [x] **CA7** · A validação visual de "Divisor de novas mensagens" e "Indo até a mensagem", nos
  dois temas, contra os frames, fica nesta pasta.
