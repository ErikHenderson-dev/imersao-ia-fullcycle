# 01: A Mensagem pode ter um bot como autor

**Status:** em andamento

**O que construir:** uma Mensagem gravada por um bot aparece para todos os Membros, no histórico e
em tempo real, como Mensagem de Agente: com o AgentAvatar, o nome do Agente e o AgentTag, e o nome
ou o avatar abrem o diálogo "Agentes". Ela conta como Não lida, não gera Notificação, nem numa
Conversa direta, e ninguém a edita nem a apaga. As Mensagens de Pessoas continuam iguais. É a
refatoração prévia que deixa o bot gravar na Conversa nas tarefas seguintes. Referências:
- spec da F11, "Autor da Mensagem" e "Cliente" ("MessageItem de bot");
- [ADR 0028](../../../../adr/0028-bots-numa-tabela-propria.md);
- design system, "Componentes" (MessageItem, AgentAvatar, AgentTag);
- PRD, história 6.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · Antes do código, o Figma ganha a Mensagem do Agente na Conversa, nas formas
  completa e compacta, nos dois temas.
- [ ] **CA2** · A migração troca o autor por `author_person_id` e `author_bot_id`, com chave
  estrangeira e um CHECK que exige exatamente um, e preserva o autor das Mensagens existentes; o
  teste das migrações prova a preservação e o CHECK.
- [ ] **CA3** · O autor sai como `{ kind, id, name, username }` no REST, no histórico e nos eventos,
  montado pela função única da Mensagem, e o `packages/chat-events` ganha o tipo.
- [ ] **CA4** · Os testes de ponta a ponta da API do chat provam, com uma Mensagem de bot gravada na
  preparação, que ela conta como Não lida para os Membros, não entra em Atividade nem numa Conversa
  direta, e que editar ou apagar responde com o erro de Mensagem de outro autor.
- [ ] **CA5** · O MessageItem de bot mostra o AgentAvatar, o nome e o AgentTag, e o nome e o avatar
  abrem o diálogo "Agentes" ao clicar ou com Enter.
- [ ] **CA6** · O Playwright prova a Mensagem de bot no histórico e chegando em tempo real à outra
  Pessoa, e o axe na Conversa com ela, nos dois temas, sem violações.
- [ ] **CA7** · A validação visual da Mensagem do Agente, nos dois temas, fica nesta pasta.
