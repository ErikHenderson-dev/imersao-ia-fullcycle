# 02: Resposta bloqueada para quem não tem Permissão de dados

**Status:** a fazer

**O que construir:** uma Mensagem do Agente marcada com Dados de negócio aparece completa para quem
tem Permissão de dados e como Resposta bloqueada (o avatar, o nome, a marca de Agente e o aviso
"Resposta com dados de negócio. Você não tem permissão para vê-la.") para os outros Membros, na
chegada em tempo real, no histórico, depois de uma queda de conexão, na Citação e no texto copiado.
Uma Citação de uma Mensagem marcada nunca leva o conteúdo ao Agente. Nesta tarefa, a Mensagem
marcada vem do bot gravando direto pela rota, sem o modelo. Referências:
- spec da F13, "Marca e Resposta bloqueada", "Citação enviada ao Agente" e "Cliente";
- [ADR 0020](../../../../adr/0020-dados-de-negocio-pessoa-a-pessoa.md);
- LLD, "Segurança" ("Dados de negócio no tempo real");
- PRD, história 6.

**Decisões consumidas de outras tarefas:**
- A Permissão de dados de cada leitor (`data_access`): 01.

**Bloqueada por:** 01

- [ ] **CA1** · Antes do código, o Figma é conferido e completado com os frames do PRD ("Todas as
  histórias"), no padrão `<Fluxo> / <Grupo> / <Estado>`, nos dois temas.
- [ ] **CA2** · A coluna `business_data` existe em `messages`, falsa por padrão; as ações `reply` e
  `question` do bot aceitam `business_data`, e uma Mensagem de Pessoa nunca a tem.
- [ ] **CA3** · A função única que monta a Mensagem recebe o leitor e, para Mensagem marcada e
  leitor sem permissão, devolve `blocked: true` com texto e Respostas prontas vazios; o mesmo vale
  para a citação de uma Mensagem marcada. Histórico, Mensagem nova, Atividade e rotas do bot passam
  por ela.
- [ ] **CA4** · `message.created` e `message.updated` de uma Mensagem marcada, ou que cita uma
  marcada, saem com a carga de cada Pessoa, e o reenvio da reconexão entrega a versão de cada uma.
- [ ] **CA5** · `MessagePayload` e a citação ganham `business_data` e `blocked` no `chat-events`.
- [ ] **CA6** · Tirar a Permissão de dados muda a próxima leitura para a versão bloqueada.
- [ ] **CA7** · A web mostra o aviso no lugar do texto na Mensagem e na Citação, sem Respostas
  prontas, e copiar a Mensagem bloqueada copia o aviso.
- [ ] **CA8** · O BFF manda `quote: null` ao Serviço de agentes quando a citada tem
  `business_data`, mesmo para quem tem permissão.
- [ ] **CA9** · Testes de ponta a ponta da API do chat (HTTP e socket), Vitest para a escolha entre
  texto e aviso e para a cópia, e Playwright com duas Pessoas (uma com permissão, outra sem) cobrem
  CA2 a CA8, com axe nos dois temas sem violações.
- [ ] **CA10** · A validação visual em 1440 × 900, nos dois temas, é registrada na pasta desta
  tarefa, e o LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
