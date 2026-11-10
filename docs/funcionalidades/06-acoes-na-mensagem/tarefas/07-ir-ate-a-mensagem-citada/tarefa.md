# 07: Ir até a Mensagem citada

**Status:** em andamento

**O que construir:** clicar na Citação de uma Mensagem, ou ativá-la pelo teclado, rola a Conversa
até a original e a destaca. Se a original não estiver carregada, a Conversa mostra "Indo até a
mensagem", carrega o histórico até ela e então rola. Se ela tiver saído no meio do caminho, aparece
o aviso de que a Mensagem não está mais disponível. Referências:
- spec da F06, "Cliente" ("Ir até a Mensagem citada" e "Telas");
- LLD, "Interfaces" (paginação) e "Valores e configuração" ("Tamanho da página" e "Distância do
  fim da lista");
- PRD, história 3.

**Decisões consumidas de outras tarefas:**
- A ReplyQuote e a `quote` na Mensagem: 06.

**Bloqueada por:** 06 (Responder citando uma Mensagem)

- [ ] **CA1** · No Figma, antes do código: criar a ida até uma Mensagem citada que não está mais
  disponível.
- [ ] **CA2** · Com a original carregada, a ReplyQuote rola até ela, no centro, e aplica o destaque
  de "Destaque por link" por 2 s.
- [ ] **CA3** · Sem a original carregada, a Conversa mostra "Indo até a mensagem" e carrega páginas
  anteriores com o limite máximo, até a que contém a original ou já começa antes dela, pela ordem
  dos ids; uma função pura decide quando parar. Sem a original, o aviso "A mensagem não está mais
  disponível" substitui o estado.
- [ ] **CA4** · Enquanto vai até a Mensagem, a Mensagem nova não puxa a lista para o fim.
- [ ] **CA5** · O Vitest prova a decisão de parar. O Playwright prova ir até uma original carregada
  e até uma que exige carregar páginas, pelo mouse e pelo teclado, e o aviso quando a original foi
  apagada.
- [ ] **CA6** · A validação visual de "Indo até a mensagem" e "Destaque por link", nos dois temas,
  contra os frames, fica nesta pasta.
