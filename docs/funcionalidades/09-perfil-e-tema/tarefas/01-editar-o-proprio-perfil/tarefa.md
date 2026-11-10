# 01: Editar o próprio Perfil

**Status:** em andamento

**O que construir:** a Pessoa abre "Editar perfil" pelo menu do avatar do Rail ou pelo botão do
próprio perfil, troca o nome, o cargo e o telefone e salva. O diálogo mostra "Salvando", o erro
embaixo de cada campo inválido e o erro geral quando a rede ou o servidor falham, sempre com o que
foi digitado mantido. Depois de salvo, o próprio Perfil já mostra a mudança, e as outras Pessoas a
veem ao recarregar ou ao abrir o perfil (o tempo real fica para a 02). Esta tarefa decide o
contrato de `PATCH /v1/people/me`, a regra do nome e o módulo de regras dos campos compartilhado
pela web, que a 03 estende com o Status. Referências:
- spec da F09, "Pessoas", "Rotas", "Módulos", "BFF" e "Cliente" ("Editar perfil" e "Telas");
- LLD, "Valores de regra" ("Tamanho do nome", "Tamanho do cargo", "Formato do telefone");
- design system, "Componentes" (Dialog, Field, Input, Button);
- PRD, história 1.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · A migração põe no nome a regra de 1 a 80 caracteres numa linha só, com CHECK, e
  falha com a Pessoa no erro se algum nome existente passar dela.
- [ ] **CA2** · `PATCH /v1/people/me` grava o nome, o cargo e o telefone, apaga cargo e telefone
  com `null` ou vazio, não muda o campo ausente, recusa o `name` nulo, vazio, com quebra de linha
  ou acima de 80 com `validation_failed` e devolve o Perfil; sem Sessão, 401.
- [ ] **CA3** · A Server Action `updateProfile` valida com as mesmas regras da API, testadas
  contra os mesmos casos, e devolve `invalid` com o campo e a mensagem de cada erro; `failure`
  para rede, servidor ou `validation_failed` que escape; 401 leva a `GET /api/session/expired`.
- [ ] **CA4** · O menu do avatar ganha "Editar perfil", e o painel do próprio perfil, o botão
  "Editar perfil"; os dois abrem o diálogo preenchido, com o foco em "Nome completo", Esc fecha
  sem salvar e o foco volta para onde estava.
- [ ] **CA5** · "Salvar" mostra "Salvando" sem aceitar segundo clique; `invalid` põe o erro embaixo
  do campo e o foco no primeiro com erro; `failure` mostra o erro geral; `ok` fecha o diálogo e o
  próprio nome no Rail, no menu e no painel já mostra o novo.
- [ ] **CA6** · O Playwright prova a edição, o "Erro de campo" com nome vazio e a mudança vista
  por outra Pessoa ao recarregar; tudo pelo teclado; e o axe no diálogo, sem violações.
- [ ] **CA7** · A validação visual dos frames "Diálogos / Editar perfil" (sem o Status, que entra
  na 03) e do menu com "Editar perfil", nos dois temas, fica nesta pasta.
