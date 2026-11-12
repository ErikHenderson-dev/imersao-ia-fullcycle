# 04: Completar a delegação pela Pergunta pendente

**Status:** concluída

**O que construir:** quando o pedido de delegação chega sem Responsável, sem o que fazer, com
"isso" sem Citação ou com dois ou mais Membros mencionados, o Agente pergunta o que falta; com
vários mencionados, oferece uma Resposta pronta com o nome de cada um. Quem pediu responde com um
clique ou escrevendo, sem mencionar o Agente, e a Tarefa é criada. Uma resposta que não completa
recebe "não consegui montar a Tarefa", sem nova pergunta. Uma delegação completa que chega como
resposta a uma pergunta de Recorte é atendida como delegação. Referências:
- spec da F12, "O Agente `assistente`" (`perguntar_delegacao` e instruções);
- spec da F11, "Envio e Pergunta pendente";
- PRD, história 2 e "Pedido incompleto: Pergunta pendente".

**Decisões consumidas de outras tarefas:**
- Contrato da ação `task`, fim da vez do modelo e regras-base das instruções: 01.

**Bloqueada por:** 01

- [x] **CA1** · A ferramenta `perguntar_delegacao(falta, candidatos?)` monta pelo código o texto da
  pergunta para `responsavel`, `o_que` e `qual` e grava pela rota de pergunta que existe.
- [x] **CA2** · Com `qual`, as Respostas prontas trazem o nome de cada candidato, com o `@usuário`
  sem arroba quando dois têm o mesmo nome, e nenhum rótulo leva `@`.
- [x] **CA3** · A ferramenta recusa rodar numa continuação, e as instruções mandam responder "não
  consegui montar a Tarefa" quando a continuação não completa.
- [x] **CA4** · As instruções tratam "isso" e afins sem Citação como pedido sem o que fazer, e uma
  resposta a uma Pergunta pendente pelo que ela pede.
- [x] **CA5** · Os testes de unidade cobrem a montagem do texto e dos rótulos; o teste de
  integração cobre o Pedido sem Responsável, a pergunta e a continuação com "@ana" que cria a
  Tarefa na mesma sessão.
- [x] **CA6** · O Playwright cobre a pergunta com as Respostas prontas de candidatos, ativas para
  quem pediu e desativadas para o outro Membro, com o bot agindo pelas rotas `/v1/bot`.

**Registros:** o teste de integração com o modelo real (a continuação que cria a Tarefa) passou depois que os créditos do Gemini voltaram. A rota de pergunta da API do chat aceita a lista vazia de Respostas prontas (LLD, "Interfaces").
