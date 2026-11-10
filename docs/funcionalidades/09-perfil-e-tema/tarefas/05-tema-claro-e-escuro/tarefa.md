# 05: Tema claro e escuro

**Status:** a fazer

**O que construir:** a Pessoa clica no botão de tema do Rail e o chat troca entre o claro e o
escuro na hora, em todas as abas daquele navegador. A escolha fica na Pessoa: ao entrar em outro
navegador, ou ao recarregar, o chat já abre no tema escolhido, sem piscar o outro. Sem Sessão, as
telas ficam no claro. Referências:
- spec da F09, "Pessoas", "Rotas", "BFF" e "Cliente" ("Tema", "Componentes novos" e "Telas");
- LLD, "Cliente" ("Tema");
- design system, "Tema claro e escuro" e "Componentes" (ThemeToggle);
- PRD, história 5.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · A migração acrescenta o tema, com `light` por padrão; `PUT /v1/people/me/theme` o
  grava, recusa valor fora da lista e não publica evento; `GET /v1/sessions/current` o devolve.
- [ ] **CA2** · O layout raiz põe `data-theme` e `color-scheme` no `<html>` pelo tema da Pessoa da
  Sessão, já no HTML do servidor; sem Sessão, fica no claro.
- [ ] **CA3** · O ThemeToggle, no Rail acima do avatar, mostra a lua no claro e o sol no escuro,
  com o nome acessível "Mudar para o tema escuro" ou "Mudar para o tema claro"; troca o tema na
  hora, grava pela Server Action `saveTheme` e avisa as outras abas do navegador, que trocam o
  delas.
- [ ] **CA4** · Na falha da gravação, o tema volta ao anterior nas abas e um toast mostra "Não foi
  possível trocar o tema".
- [ ] **CA5** · O design system passa a apontar para o LLD ("Cliente", "Tema") em vez de dizer que
  o lugar da escolha está a definir.
- [ ] **CA6** · O Playwright prova a troca nas duas abas do mesmo contexto e o tema aplicado num
  contexto novo da mesma Pessoa, com o `data-theme` já no HTML do servidor; tudo pelo teclado; e
  o axe nas telas principais nos dois temas, sem violações.
- [ ] **CA7** · A validação visual do Rail com o botão de tema, nos dois temas, fica nesta pasta,
  e o roteiro do Lighthouse com nota 100 nos dois temas também.
