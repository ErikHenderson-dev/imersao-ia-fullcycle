# 06: Conectar um Agente

**Status:** concluída

**O que construir:** o administrador vê na seção Agentes "Conectar agentes", com o número de
desconectados, "Adicionar agente" ou "Gerenciar agentes", conforme o estado. Ele abre o diálogo e
conecta um Agente, que passa por "Conectando" e aparece como conectado, com a linha na barra
lateral. Se a conexão falhar, ou se ele tiver perdido o papel, nada muda e ele vê o erro. As outras
Pessoas veem a mudança ao recarregar; o tempo real é da 08. Esta tarefa decide:
- a rota `PUT /v1/agents/:slug/connection`, com a ordem das conferências;
- a Server Action `connectAgent` e a união de resultado (`ok`, `unauthenticated`, `failure`,
  `forbidden`), que a 07 segue;
- as variantes de administrador da seção.

Referências:
- spec da F10, "Registro de Agentes" (conectar idempotente), "Rotas e credencial", "BFF" e
  "Cliente" ("Seção Agentes da barra lateral", "Diálogo Agentes" e "Telas");
- frames "Casca / Agentes" (Admin sem nenhum conectado, Admin com parte conectada, Admin com todos
  conectados) e "Diálogos / Agentes" (Admin sem conectados, Admin com conectado, Conectando);
- [ADR 0015](../../../../adr/0015-permissoes-enviadas-pelo-bff.md);
- PRD, história 1.

**Decisões consumidas de outras tarefas:**
- API e variantes do `SidebarAction`: 01.
- `is_admin` e o `set-admin`: 02.
- Base de testes de integração do Serviço de agentes e padrão das rotas `/v1`: 04.
- Cliente do BFF, `GET /api/agents`, tipo `Agent`, cache do SWR, escolha da variante da seção e e2e
  com o Serviço de agentes: 05.

**Bloqueada por:** 05 (Ver os Agentes e os administradores)

- [x] **CA1** · Antes do código, o Figma ganha o erro ao conectar, nos dois temas.
- [x] **CA2** · `PUT /v1/agents/:slug/connection` responde 204, inclusive repetido, sem mudar o
  `connected_by`; `unauthorized` sem credencial, `forbidden` sem `is_admin` antes de
  `agent_not_found` com `slug` fora do catálogo, e `validation_failed`; os testes de integração
  cobrem os casos.
- [x] **CA3** · `connectAgent` lê a Pessoa da Sessão sem cache, devolve `forbidden` sem chamar o
  Serviço de agentes quando ela não administra, e `failure` para qualquer falha dele.
- [x] **CA4** · Para o administrador, a seção mostra "Conectar agentes" com o CountBadge dos
  desconectados, "Adicionar agente" com os conectados ou "Gerenciar agentes" com todos; cada linha
  e cada ação abrem o diálogo; o Vitest cobre as variantes de administrador.
- [x] **CA5** · O diálogo do administrador mostra "Conectar" nos desconectados e o aviso de "Admin
  sem conectados"; "Conectar" passa por "Conectando", sem segundo clique, e termina conectado; a
  falha mostra o toast de erro, e `forbidden` mostra "Só administradores conectam agentes".
- [x] **CA6** · O Playwright prova o administrador conectando o `assistente` pelo teclado e a outra
  Pessoa vendo a linha ao recarregar; um administrador que perdeu o papel pelo comando, com a tela
  aberta, recebe o erro; o axe no diálogo do administrador, nos dois temas, sem violações.
- [x] **CA7** · A validação visual dos frames de administrador citados, nos dois temas, fica nesta
  pasta.
