# 03: Reserva do @usuário dos Agentes

**Status:** concluída

**O que construir:** quem opera a instalação cria o bot de cada Agente pelo comando de contas, e o
`@usuário` dele fica reservado: nenhuma Pessoa nova pode tê-lo, e nenhum bot pode ter o `@usuário`
de uma Pessoa ou de outro bot. Na F10, o bot não aparece em lugar nenhum do chat; a F11 o liga às
Mensagens. Esta tarefa decide a tabela `bots` e a função única de "`@usuário` livre". Referências:
- spec da F10, "Bots" e "Comando de contas";
- [ADR 0028](../../../../adr/0028-bots-numa-tabela-propria.md);
- LLD, "Valores de regra" ("Formato do @usuário", "Tamanho do nome");
- PRD, "Regras desta funcionalidade" (reserva do `@usuário`).

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [x] **CA1** · A migração cria `bots` com `username` único e os CHECKs de formato do `@usuário` e
  do nome das Pessoas; o teste das migrações prova a recusa de `username` repetido e fora do
  formato.
- [x] **CA2** · `create-bot <username> <nome>` cria o bot e recusa formato inválido, nome inválido,
  `@usuário` de uma Pessoa e `@usuário` de outro bot, com mensagens claras.
- [x] **CA3** · `create` recusa o `@usuário` de um bot, informado em `--username` ou derivado do
  e-mail, pela mesma função de "`@usuário` livre".
- [x] **CA4** · O bot não aparece no login, na busca de Pessoas, nos Membros nem na Presença: os
  testes de integração da busca continuam passando com um bot criado.
- [x] **CA5** · O guia de subida do ambiente, no `AGENTS.md` da raiz, inclui a criação do bot
  `assistente`.
