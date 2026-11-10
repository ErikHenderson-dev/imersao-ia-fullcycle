# 02: Abrir a Conversa na Mensagem

**Status:** a fazer

**O que construir:** abrir a Conversa por um link que aponta uma Mensagem leva direto a ela, com o
destaque, mesmo quando ela está longe no histórico. É o destino do item de Atividade, do Alerta e
da notificação do navegador. O formato do link, `/conversas/:id?mensagem=:messageId`, já está
fixado na spec; esta tarefa o implementa na Conversa, e as outras só montam o link. Referências:
- spec da F08, "Cliente" ("Abrir a Conversa na Mensagem");
- spec da F06, "Cliente" ("Ir até a Mensagem citada"); spec da F07, "Cliente" ("Abrir na primeira
  Não lida e o divisor");
- PRD, história 3.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · Com `?mensagem=`, a Conversa rola até a Mensagem e aplica o destaque por 2 s; se
  ela não está na página carregada, mostra "Indo até a mensagem" e carrega as anteriores, como a
  ida da F06.
- [ ] **CA2** · O destino tem prioridade sobre a primeira Não lida da F07, e o divisor "Novas
  mensagens" continua onde a F07 o põe; a decisão sai de uma função pura com teste.
- [ ] **CA3** · Depois de rolar, o parâmetro sai da URL, e recarregar a página não rola de novo.
- [ ] **CA4** · Uma Mensagem que não aparece (apagada no caminho) segue o que a F06 faz com a
  Mensagem citada que não aparece.
- [ ] **CA5** · Abrir assim, com a aba em foco, lê a Conversa como na F07.
- [ ] **CA6** · O Playwright prova a ida até uma Mensagem fora da primeira página, com o destaque e
  o divisor, e a URL sem o parâmetro depois.
