# 01: Números na barra lateral

**Status:** concluída

**O que construir:** ao carregar a página, a barra lateral mostra em negrito as Conversas com
Mensagens Não lidas e o contador: o número de Menções Não lidas num Canal e o número de Não lidas
numa Conversa direta. A Última leitura passa a existir em cada participação, começa no lugar certo
para quem entra numa Conversa e avança quando a pessoa envia uma Mensagem. Esta tarefa decide os
campos da lista de Conversas (`last_read_message_id`, `unread_count`, `mention_count`) e a função
de contagem, que a 02 e a 03 reaproveitam. Ler a Conversa fica para a 02, e o tempo real para a
03: aqui, os números mudam ao recarregar. Referências:
- spec da F07, "Última leitura e contagem", "Rotas" (`GET /v1/conversations`), "BFF" (o tipo
  `Conversation`), "Cliente" ("Lista de Conversas e barra lateral", "Componentes novos" e
  "Telas");
- ADR 0026; LLD, "Concorrência e idempotência" ("Não lidas e menções", "Última leitura") e
  "Valores de regra" ("Teto da contagem de não lidas");
- design system, "Estados" (Não lido) e "Componentes" (CountBadge, SidebarRow, SidebarSection);
- PRD, histórias 1 e 2.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [x] **CA1** · No Figma, antes do código: criar a Conversa direta com contador de Não lidas na
  barra lateral e a seção recolhida com as Conversas Não lidas visíveis.
- [x] **CA2** · A migração acrescenta a Última leitura às participações e põe cada uma que já
  existe na última Mensagem da Conversa, ou nula sem Mensagens; o teste da migração prova isso.
- [x] **CA3** · A Última leitura inicial segue a spec: quem é adicionado a um Canal privado, a
  conta nova nos Canais públicos e quem abre uma Conversa direta começam na última Mensagem que já
  existia; a outra Pessoa da Conversa direta começa nula, e a primeira Mensagem conta.
- [x] **CA4** · Enviar uma Mensagem avança a Última leitura do autor na mesma transação, só para
  frente; o reenvio idempotente não muda nada.
- [x] **CA5** · `GET /v1/conversations` traz, em cada Conversa, a Última leitura e os números: as
  Mensagens de outros posteriores à Última leitura contam; as próprias, as apagadas e as anteriores
  não; a Menção conta uma vez por Mensagem; a Menção a si mesma e a Conversa direta consigo mesma
  não contam; as duas contagens param no teto, numa consulta só para a lista inteira. A edição que
  acrescenta ou tira a Menção de uma Mensagem Não lida e a exclusão de uma Não lida mudam os
  números, sem gravação a mais.
- [x] **CA6** · O CountBadge entra como primitivo (`99+` acima de 99, some em zero) e a SidebarRow
  ganha o estado Não lida: negrito com Não lidas; contador de Menções no Canal e de Não lidas na
  Conversa direta.
- [x] **CA7** · Cada linha anuncia ao leitor de tela o nome e o que há de novo, como no PRD, sem o
  número visual lido duas vezes; o texto sai de uma função pura com teste.
- [x] **CA8** · Uma seção recolhida continua mostrando as Conversas dela com Não lidas, com o
  negrito e o contador.
- [x] **CA9** · O Playwright prova a Menção num Canal e a Mensagem numa Conversa direta aparecendo,
  depois de recarregar, com o negrito e o contador certos na outra Pessoa, e o axe na barra lateral
  com Não lidas, sem violações.
- [x] **CA10** · A validação visual de "Casca / Sidebar / Com dados", da seção recolhida e da
  Conversa direta com contador, nos dois temas, contra os frames, fica nesta pasta.
