# 02: Papel de administrador e selo no perfil

**Status:** concluída

**O que construir:** quem opera a instalação dá e tira o papel de administrador de uma Pessoa pelo
comando de contas. O papel vale na próxima ação, sem sair e entrar, e o painel de perfil de um
administrador mostra o selo "Administrador" abaixo do `@usuário`, inclusive no próprio Perfil, na
próxima vez que é aberto. Esta tarefa decide a coluna `is_admin`, o campo `is_admin` na Sessão e
no Perfil, o `isAdmin` nos tipos da web e o `set-admin`, que as tarefas seguintes usam para
preparar os testes. Referências:
- spec da F10, "Papel de administrador", "Comando de contas", "BFF" ("Tipos da web") e "Cliente"
  ("Selo de administrador");
- frame "Painel de perfil / Selo de administrador" (26:45404);
- PRD, histórias 5 e 6.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [x] **CA1** · A migração acrescenta `is_admin`, obrigatório, com `false` nas Pessoas que já
  existem.
- [x] **CA2** · `GET /v1/sessions/current` e `GET /v1/people/:id` trazem `is_admin`, lido do banco
  a cada requisição.
- [x] **CA3** · `set-admin <e-mail|@usuário> on|off` dá e tira o papel, aceita o `@usuário` com
  `@`, escreve o resultado, diz "já era" quando nada muda e falha com a mensagem certa para Pessoa
  inexistente ou argumento inválido; os testes de integração do comando cobrem os casos.
- [x] **CA4** · O painel de perfil mostra o selo quando o Perfil traz `isAdmin`, como no frame, nos
  dois temas, com texto acessível.
- [x] **CA5** · O Playwright prova o selo no perfil de um administrador, visto por outra Pessoa e
  por ele mesmo, e a ausência dele em quem não administra; o axe no painel de perfil com o selo,
  nos dois temas, sem violações.
- [x] **CA6** · A validação visual do frame do selo, nos dois temas, fica nesta pasta.
