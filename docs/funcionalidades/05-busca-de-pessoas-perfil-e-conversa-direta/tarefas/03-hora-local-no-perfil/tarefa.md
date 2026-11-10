# 03: Hora local no Perfil

**Status:** a fazer

**O que construir:** o Perfil mostra que horas são para a Pessoa ("14:32 no horário local"), e a
hora avança enquanto o painel está aberto. O fuso vem do navegador da Pessoa e é gravado sempre
que ela abre o chat num fuso diferente do gravado; quem nunca abriu o chat fica sem a linha.
Referências:
- spec da F05, "Pessoas" (`time_zone`), "Busca e Perfil" ("Fuso" e "Sessão"), "Rotas"
  (`PUT /v1/people/me/time-zone`), "BFF" (`saveTimeZone`) e "Cliente" ("Fuso" e "Painel de
  perfil");
- LLD, "Cliente", "Cookies do cliente" (Fuso, com a alteração planejada);
- PRD, "Regras desta funcionalidade" (fuso) e critérios das histórias 2 e 3.

**Decisões consumidas de outras tarefas:**
- Coluna `time_zone` de `people`: 01.
- Provedor e painel de perfil: 02.

**Bloqueada por:** 01 (@usuário, cargo e telefone pelo comando de contas), 02 (Ver um Perfil pelo
autor da Mensagem, pela lista de Membros e pelo menu do avatar)

- [ ] **CA1** · `PUT /v1/people/me/time-zone` grava o fuso da Pessoa da Sessão (204), aceito só se o
  `Intl.DateTimeFormat` do Node o reconhece; o inválido: `validation_failed` (400); sem Sessão,
  401.
- [ ] **CA2** · A Pessoa devolvida ao entrar e ao verificar a Sessão ganha `time_zone`.
- [ ] **CA3** · O Server Action `saveTimeZone` valida a entrada e devolve a união discriminada da
  F01. O `TimeZoneSync` passa a comparar o fuso do navegador com o `time_zone` da Pessoa da Sessão
  e, se diferem, chama `saveTimeZone` uma vez por carga da página, sem mostrar a recusa à pessoa e
  sem tentar de novo na mesma carga. O cookie de fuso continua como na F02.
- [ ] **CA4** · Uma função pura dá a hora local no fuso da Pessoa, e o painel a atualiza a cada
  virada de minuto. Sem `time_zone`, a linha não aparece.
- [ ] **CA5** · Os testes de ponta a ponta da API provam o fuso válido no Perfil e na Sessão, o
  inválido e o 401. O Vitest prova a hora local num fuso diferente do navegador.
- [ ] **CA6** · O Playwright, com o navegador num fuso definido, prova que o Perfil da própria
  Pessoa mostra a hora nesse fuso depois de abrir o chat.
