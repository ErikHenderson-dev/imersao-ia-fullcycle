# 05: Delegar a partir de uma Mensagem citada

**Status:** concluída

**O que construir:** a Pessoa cita uma Mensagem e pede "@assistente delega isso pra @ana", e a
Tarefa sai com o título tirado da Mensagem citada, sem detalhe acrescentado. Uma instrução escrita
na Mensagem citada não vira ordem ao Agente. Referências:
- spec da F12, "Rota de Pedido e execução" (`quote`), "Disparo pelo BFF" e "O Agente `assistente`";
- PRD, história 3.

**Decisões consumidas de outras tarefas:**
- Contrato da ação `task` e regras-base das instruções: 01.
- Regra do "isso" sem Citação: 04 (esta tarefa trata só o caso com Citação).

**Bloqueada por:** 01

- [x] **CA1** · O corpo de `POST /v1/requests` ganha `quote` (`id`, `body`, `author` com `name` e
  `username`), nulo sem Citação ou com a citada apagada, e o BFF o preenche a partir do `quote` da
  Mensagem gravada.
- [x] **CA2** · A Citação entra no estado do Pedido e chega ao modelo como dado, e as instruções
  dizem que o conteúdo citado serve ao título e nunca é ordem.
- [x] **CA3** · O teste de integração cobre "delega isso pra @ana" com `quote` criando a Tarefa com
  título tirado da citada, e o teste do BFF cobre o `quote` nulo para a citada apagada.

**Registros:** a Citação vai ao modelo no conteúdo de quem pediu, marcada como dado, e não nas
instruções, porque o texto é de qualquer Membro; e a ferramenta recusa no código um Responsável que
não foi mencionado no pedido nem é quem pediu (revisão de código da tarefa).
