# 09: Mencionar um Agente conectado

**Status:** em andamento

**O que construir:** ao digitar `@` no composer, a Pessoa encontra os Agentes conectados no
autocompletar, depois dos Membros e com o avatar de Agente. A Menção a um Agente conectado fica
destacada na Mensagem, para todas as Pessoas, e abre o diálogo "Agentes" com um clique ou Enter.
Um Agente desconectado some do autocompletar, e as Menções a ele, novas e antigas, viram texto
comum. Na F10, mencionar não gera resposta nem Notificação. Referências:
- spec da F10, "Cliente" ("Menção a um Agente" e "Telas");
- spec da F06, "Mensagens" (Menções gravadas e o limite de palavra);
- design system, "Componentes" (MentionChip, AgentAvatar);
- PRD, história 4.

**Decisões consumidas de outras tarefas:**
- Cache do SWR da lista de Agentes e e2e com o Serviço de agentes: 05.
- Conectar pelo diálogo, para preparar o teste: 06.

**Bloqueada por:** 06 (Conectar um Agente)

- [ ] **CA1** · Antes do código, o Figma ganha o autocompletar com um Agente e o `AgentMentionChip`
  numa Mensagem, nos dois temas.
- [ ] **CA2** · O autocompletar junta, depois dos Membros, os Agentes conectados cujo nome ou
  `@usuário` começa pelo que se digita, e escolher um insere `@<username>`; com a lista
  indisponível, nenhum Agente aparece.
- [ ] **CA3** · O `splitMessageBody` reconhece o `@usuário` dos Agentes conectados com o limite de
  palavra das Menções gravadas, e a Menção a uma Pessoa ganha da de um Agente com o mesmo
  `@usuário`; o Vitest cobre esses casos e o filtro do autocompletar.
- [ ] **CA4** · O `AgentMentionChip`, no tom de Menção a outra Pessoa, abre o diálogo "Agentes" ao
  clicar ou com Enter, e tem nome acessível.
- [ ] **CA5** · Mencionar um Agente não grava Menção, não gera Notificação nem muda as não lidas.
- [ ] **CA6** · O Playwright prova `@ass` mostrando o Agente, a Mensagem enviada com o chip vista
  pela outra Pessoa, o chip abrindo o diálogo pelo teclado e, depois de desconectar, o chip como
  texto comum ao recarregar; o axe no autocompletar, nos dois temas, sem violações.
- [ ] **CA7** · Se a 08 já estiver concluída, o Playwright prova também o chip virando texto comum
  para a outra Pessoa sem recarregar depois de desconectar; senão, esse cenário fica com a 08.
- [ ] **CA8** · A validação visual do autocompletar e do chip, nos dois temas, fica nesta pasta.
