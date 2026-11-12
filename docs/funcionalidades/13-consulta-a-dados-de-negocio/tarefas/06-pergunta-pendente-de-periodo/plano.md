# Plano da F13-T06: Pergunta pendente de período

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de unidade

**Cenário:** Dado um Pedido novo, quando a ferramenta `perguntar_periodo` roda, então a API do chat
recebe a pergunta "De que período?" com as Respostas prontas "Este mês", "Mês passado" e "Este ano",
sem `business_data`, e o Pedido fica marcado como respondido por pergunta; numa continuação, a
ferramenta devolve o `erro` de não perguntar de novo e não grava nada.

**Teste previsto:** unidade, `tests/unit/test_business_period_question.py`, "grava a pergunta de
período com as três Respostas prontas sem a marca" e "recusa perguntar numa continuação".

### CA2

**Marca:** revisão humana

**Cenário:** Quem revisa abre `instructions.py` e encontra: sem período, chamar `perguntar_periodo`
e não escrever nada; quando a última ação foi `perguntar_periodo`, a Mensagem atual é o período ("Este
mês", "Mês passado", "Este ano" ou dito com outras palavras), e o Agente chama `consultar_dados` com a
Métrica do pedido anterior; e, numa continuação que não completa a consulta, responder só "Não
entendi o que consultar. Para perguntar um número, mencione o Agente de novo com a Métrica e o
período.", sem perguntar de novo.

### CA3

**Marca:** revisão humana

**Cenário:** Quem revisa encontra nas instruções que cada Pedido é completo: "e em abril?" sozinho,
sem Métrica, recebe a mesma frase de "não entendi o que consultar", e a Métrica de uma resposta
anterior não é reaproveitada.

### CA4

**Marca:** teste no Playwright

**Cenário:** Dado o bot do teste (com `@usuário` próprio) e a Ana e o Bruno num Canal, quando o bot
grava pela rota a pergunta "De que período?" com as três Respostas prontas, então a Ana vê os
botões ativos e o Bruno os vê desativados, com o motivo no rótulo acessível. Com o modelo real, os
testes de integração cobrem a pergunta, a continuação "Mês passado", que responde, e a continuação
que não completa.

**Teste previsto:** Playwright, `e2e/agentes/pergunta-de-periodo.spec.ts`, "os botões de período
valem só para quem pediu"; integração com o modelo real, `tests/integration/test_request_business.py`,
"sem período grava a pergunta", "a continuação mês passado responde" e "a continuação que não
completa recebe não entendi".

### CA5

**Marca:** documento

**Cenário:** Quem revisa abre o LLD e encontra a pergunta de período em "6.6 Consulta a dados de
negócio" como `existe`.

## Contrato

O contrato não muda: a pergunta usa a rota de pergunta que existe, sem `business_data`.

## Verificação do contrato

Nenhum item.

## Decisões

- `perguntar_periodo` mora em `app/business/period_question.py` (`ask_period`), e a função do ADK em
  `tools.py` só a chama; ela usa o `ask_question` comum (F13-T05) e o `NAO_PERGUNTE` da pergunta de
  Recorte.
- A pergunta de período não confere a Permissão de dados nem grava auditoria: não toca o banco nem
  revela dado (spec, "Auditoria"). Sem permissão, a continuação chama `consultar_dados`, que dá a
  recusa sem permissão.
- A frase de "não entendi o que consultar" fica em `instructions.py`, como `NAO_ENTENDI` da F11 e
  `NAO_CONSEGUI_MONTAR` da F12, e vale tanto para a continuação que não completa quanto para o
  Pedido sem Métrica.

## Arquivos e interfaces

- `app/business/period_question.py`: `PERIOD_QUESTION`, `PERIOD_OPTIONS`, `ask_period(client,
  tool_context)`.
- `app/agents/assistente/tools.py`: `perguntar_periodo(tool_context)`; `agent.py`: a ferramenta na
  lista; `instructions.py`: `NAO_ENTENDI_CONSULTA` e as regras.
- `tests/unit/test_business_period_question.py`; `tests/integration/test_request_business.py`.
- Web: `e2e/agentes/pergunta-de-periodo.spec.ts`, `e2e/plano-de-testes-f13.md`.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: a seção 6.6 do LLD já diz que a pergunta de período é da F13-T06. No fim
da tarefa, ela passa a `existe` pela skill `lld`.
