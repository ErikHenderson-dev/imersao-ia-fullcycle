# 02: Barra de ações, menu e copiar o texto

**Status:** em andamento

**O que construir:** ao passar o mouse sobre uma Mensagem, ou pôr o foco nela, aparece a barra de
ações, e "Mais ações" abre o menu da Mensagem. "Copiar texto" copia o texto e mostra o aviso
"Texto copiado", ou um aviso de erro se o navegador recusar. Mensagens "Enviando" ou com falha no
envio não têm barra nem menu. Esta tarefa decide a estrutura da barra e do menu, onde a 03, a 04 e
a 06 acrescentam "Editar", "Apagar" e "Responder". Referências:
- spec da F06, "Cliente" ("Barra de ações e menu", "Copiar texto" e "Telas");
- design system, "Bibliotecas" (`sonner`) e "Componentes" (Tooltip, Toast, MessageActions);
- PRD, história 4 e "Barra de ações e menu".

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · No Figma, antes do código: criar a falha ao copiar o texto (toast de erro).
- [ ] **CA2** · O Tooltip (atraso do design system) entra em `components/ui`; o `sonner` é
  instalado e o Toaster entra no layout das telas logadas, no canto inferior direito, com botão de
  fechar.
- [ ] **CA3** · A MessageActions aparece no hover e com o foco dentro da Mensagem, com "Copiar
  texto" e "Mais ações" como IconButtons com Tooltip; a MessageMenu é um DropdownMenu com "Copiar
  texto". Mensagens `sending` e `failed` não renderizam nenhum dos dois.
- [ ] **CA4** · "Copiar texto", na barra e no menu, copia o `body` como está gravado, sem autor nem
  hora, e mostra "Texto copiado"; na recusa, "Não foi possível copiar o texto".
- [ ] **CA5** · Pelo teclado: a barra é alcançável por Tab a partir da Mensagem, o menu abre com
  Enter ou Espaço, as setas mudam o item e Esc fecha, devolvendo o foco ao botão.
- [ ] **CA6** · O Playwright prova copiar o texto e conferir a área de transferência (permissão
  `clipboard-read` no contexto), a recusa da área de transferência, a ausência da barra numa
  Mensagem com falha no envio, o caminho só pelo teclado e o axe com a barra e o menu abertos, sem
  violações.
- [ ] **CA7** · A validação visual de "Hover com barra de ações" e "Menu de mensagem de terceiros",
  nos dois temas, contra os frames, fica nesta pasta.
