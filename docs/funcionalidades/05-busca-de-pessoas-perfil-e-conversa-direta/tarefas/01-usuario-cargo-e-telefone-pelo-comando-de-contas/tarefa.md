# 01: @usuário, cargo e telefone pelo comando de contas

**Status:** em andamento

**O que construir:** toda Pessoa passa a ter um `@usuário` único, e as contas que já existem o
recebem do e-mail, sem ninguém precisar fazer nada. Quem opera a instalação informa o `@usuário`, o
cargo e o telefone ao criar uma conta, e troca o cargo e o telefone depois, pelo comando de contas.
A Pessoa ganha também o lugar do fuso, preenchido pela 03. Referências:
- spec da F05, "Pessoas", "Busca e Perfil" ("Sessão"), "Módulos" e "Comando de contas";
- LLD, "Dados" (Pessoas) e "Valores e configuração" (formato do @usuário, tamanho do cargo e
  formato do telefone);
- PRD, "Regras desta funcionalidade" e critérios de "Comando de contas"; spec, história 8.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · `people` ganha `username`, `title`, `phone` e `time_zone`, numa migração, com os
  `CHECK` do formato do @usuário, do tamanho do cargo e do formato do telefone. `username` fica
  obrigatório e único depois de preenchido.
- [ ] **CA2** · A migração dá às contas que já existem o `@usuário` da parte do e-mail antes do
  `@`, pela regra da spec: minúsculas, sem acento, sem os caracteres fora do formato e sem os que
  não são letra ou número no começo e no fim; sufixo `2`, `3` e assim por diante pela ordem de
  criação da conta, pulando um valor que já exista; `pessoa` quando sobram menos de 2 caracteres.
- [ ] **CA3** · Uma função pura da API faz a mesma derivação para as contas novas, e a unidade a
  prova com acentos, `+`, pontos nas pontas, o resultado curto e o corte com sufixo.
- [ ] **CA4** · `create` aceita `--username`, `--title` e `--phone`. Sem `--username`, deriva do
  e-mail com sufixo quando repete. `@usuário` informado já usado, ou qualquer valor fora da regra,
  recusa a criação com uma mensagem que diz o motivo. Cargo e telefone vazios gravam nulo.
- [ ] **CA5** · `update-profile <e-mail>` troca o cargo e o telefone, com ao menos um dos dois; o
  valor vazio apaga o campo; conta inexistente e valor fora da regra são recusados com mensagem. O
  `@usuário` não muda por nenhuma operação.
- [ ] **CA6** · A Pessoa devolvida ao entrar e ao verificar a Sessão ganha `username`.
- [ ] **CA7** · O teste de banco prova a migração (derivação, sufixo pela ordem de criação e
  `pessoa`); o teste de integração do comando prova o CA4 e o CA5; o de ponta a ponta das Sessões,
  o `username` na resposta.
- [ ] **CA8** · As duas operações ficam no `AGENTS.md` da API, seção "Comandos".
