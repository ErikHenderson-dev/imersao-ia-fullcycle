# 05: A outra Pessoa recebe a Conversa direta na primeira Mensagem

**Status:** concluída

**O que construir:** quem abriu uma Conversa direta envia a primeira Mensagem, e a Conversa aparece
na barra lateral da outra Pessoa, sem recarregar e em todas as abas dela, com a Mensagem chegando
em tempo real. Antes disso, a outra Pessoa não vê a Conversa, nem pelo endereço, nem recebe o
"digitando". Referências:
- spec da F05, "Conversa direta" ("Primeira Mensagem" e "Acesso"), "Módulos" e "Tempo real";
- LLD, "Concorrência e idempotência" ("Primeira Mensagem da Conversa direta");
- [ADR 0025](../../../../adr/0025-membro-da-conversa-direta-na-primeira-mensagem.md);
- PRD, histórias 5 e 7.

**Decisões consumidas de outras tarefas:**
- Conversa direta, `counterpart` e ordem das Conversas diretas na lista: 04.

**Bloqueada por:** 04 (Abrir uma Conversa direta pelo Perfil)

- [x] **CA1** · O envio de Mensagem passa a ser uma transação. Depois de gravar uma Mensagem nova
  numa Conversa direta, grava a participação da outra Pessoa do par, tolerando a que já existe; o
  reenvio idempotente não grava nada a mais.
- [x] **CA2** · Se a participação foi gravada agora, depois do commit são publicados, um depois do
  outro, o `conversation.member_added` (`person_ids` da outra Pessoa, para as abas dela e as do
  autor) e o `message.created`, pela publicação do módulo de participação. A falha na publicação vai
  para o log, como no envio da F03.
- [x] **CA3** · Os testes de ponta a ponta da API provam que a primeira Mensagem torna a outra Pessoa
  Membro e põe a Conversa na lista dela com o `counterpart`; que, antes dela, a outra Pessoa recebe
  404 na Conversa, no histórico e no envio; e que o reenvio não grava nada a mais.
- [x] **CA4** · Os testes de tempo real provam que a outra Pessoa recebe o `member_added` e depois o
  `message.created`, nessa ordem; a segunda Mensagem, só o `message.created`; os dois voltam na
  reconexão com cursor, na mesma ordem; e ela não recebe o "digitando" antes da primeira Mensagem.
- [x] **CA5** · O Playwright, com duas Pessoas em dois contextos, prova que a Conversa aberta sem
  Mensagem não aparece para a outra, nem pelo endereço ("Conversa não encontrada"); que, depois da
  primeira Mensagem, ela aparece na barra lateral da outra sem recarregar e sem abrir sozinha; e
  que a resposta chega em tempo real.
