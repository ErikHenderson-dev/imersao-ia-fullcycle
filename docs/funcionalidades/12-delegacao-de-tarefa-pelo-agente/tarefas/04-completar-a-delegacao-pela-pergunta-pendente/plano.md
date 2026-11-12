# Plano da F12-T04: Completar a delegação pela Pergunta pendente

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de unidade

**Cenário:** Dado o estado de um Pedido `new`, quando a ferramenta pergunta por `responsavel`, por
`o_que` ou por `qual`, então grava pela rota de pergunta, uma vez, o texto fixo "A quem eu delego?",
"O que devo delegar?" ou "Para quem é a Tarefa?", com as Respostas prontas só em `qual`, e marca o
Pedido como respondido pela ferramenta (`question`).

**Teste previsto:** unidade, `tests/unit/test_delegation_question.py`, "pergunta o que falta com o
texto fixo".

### CA2

**Marca:** teste de unidade

**Cenário:** Dado dois candidatos com nomes diferentes, os rótulos são os nomes; com dois "Ana
Souza", os rótulos são "Ana Souza (ana)" e "Ana Souza (ana.s)"; um nome longo é cortado no tamanho
máximo do rótulo; acima de quatro candidatos, entram os quatro primeiros; nenhum rótulo tem `@`; um
candidato que não está entre as Pessoas mencionadas fica de fora.

**Teste previsto:** unidade, `tests/unit/test_delegation_question.py`, "os rótulos dos
candidatos".

### CA3

**Marca:** teste de unidade

**Cenário:** Numa continuação, a ferramenta não grava nada e devolve o erro que manda não perguntar
de novo. Quem revisa encontra nas instruções a frase "não consegui montar a Tarefa" para a
continuação que não completa a delegação.

**Teste previsto:** unidade, `tests/unit/test_delegation_question.py`, "não pergunta numa
continuação".

### CA4

**Marca:** revisão humana

**Cenário:** Quem revisa abre as instruções do `assistente` e encontra: "isso", "aquilo" e afins sem
Citação contam como pedido sem o que fazer; uma resposta a uma Pergunta pendente é tratada pelo que
pede, inclusive uma delegação completa que chega como resposta à pergunta de Recorte; e quando
chamar `perguntar_delegacao` com cada `falta`.

### CA5

**Marca:** teste de integração

**Cenário:** Com o app real, o modelo real e a API do chat falsa, quando chega "@assistente delega a
revisão do contrato", sem Responsável, então a API falsa recebe a pergunta "A quem eu delego?";
quando chega a continuação "@ana" (com a Ana em `mentions`), então a API falsa recebe a ação `task`
com `assignee_username` `ana`, na sessão do Pedido que perguntou. Os testes de unidade de CA1 a CA3
completam o critério.

**Teste previsto:** integração, `tests/integration/test_request_task.py`, "sem Responsável,
pergunta e a continuação cria a Tarefa".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado a Ana e o Bruno num Canal, quando o bot grava, no Pedido da Ana, a pergunta "Para
quem é a Tarefa?" com as Respostas prontas "Bruno Lima" e "Caio Dias", então os botões aparecem
ativos para a Ana e desativados para o Bruno; o clique da Ana vira a Mensagem "Bruno Lima" dela e
desativa os botões para os dois.

**Teste previsto:** Playwright, `e2e/agentes/pergunta-de-delegacao.spec.ts`, "a pergunta com os
candidatos vale só para quem pediu".

## Contrato

O contrato não muda: a pergunta usa a rota `POST /v1/bot/requests/:id/question` da F11.

## Verificação do contrato

Nada a verificar.

## Decisões

- O texto da pergunta e os rótulos são do código, como na pergunta de Recorte: o modelo só escolhe o
  que falta e os candidatos.
- Os candidatos chegam como `@usuário` e só valem os que estão entre as Pessoas mencionadas no
  Pedido, que o estado da sessão traz com o nome. O retorno da ferramenta leva o par rótulo e
  `@usuário` de cada candidato, e é por ele, no histórico da sessão, que o modelo reconhece o clique
  na continuação.
- O nome repetido ganha o `@usuário` entre parênteses, sem arroba, e o rótulo respeita o tamanho
  máximo da Resposta pronta (64) e o máximo de quatro botões da F11.
- A marca "respondido pela ferramenta" é a mesma da pergunta de Recorte (`question`), então o fim do
  Pedido não muda.

## Arquivos e interfaces

- `app/agent_requests/delegation_question.py`: textos, `candidate_labels(candidatos, mentions)` e
  `ask_delegation(client, tool_context, falta, candidatos)`.
- `app/agents/assistente/tools.py`: `perguntar_delegacao(falta, tool_context, candidatos=None)`.
- `app/agents/assistente/agent.py`: a ferramenta na lista.
- `app/agents/assistente/instructions.py`: as regras da pergunta de delegação.
- `tests/unit/test_delegation_question.py`, `tests/integration/test_request_task.py`.
- Web: `e2e/agentes/pergunta-de-delegacao.spec.ts`, `e2e/plano-de-testes-f12.md`.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum: o LLD não registra as ferramentas do Agente, que estão na spec.
