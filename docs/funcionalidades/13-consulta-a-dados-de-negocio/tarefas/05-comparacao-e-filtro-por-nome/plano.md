# Plano da F13-T05: Comparação entre períodos e filtro por nome

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de unidade

**Cenário:** Dado o valor de março e o de fevereiro, quando o código escreve a comparação, então sai
"Faturamento de março de 2026: R$ 1.234.567,89. Fevereiro de 2026: R$ 1.100.000,00. Variação:
+12,2%." e a linha "Considerado: …, de 01/03/2026 a 31/03/2026 contra 01/02/2026 a 28/02/2026,
fuso America/Sao_Paulo."; a variação negativa sai como "-4,5%"; com a base zero,
"Sem variação percentual: a base é zero."; e o lastro aceita os dois valores e a variação. A
integração prova a comparação de cada Métrica com o mesmo filtro contra o SQL à mão.

**Teste previsto:** unidade, `tests/unit/test_business_answer.py`, "a comparação tem os dois valores
e a variação com sinal", "a variação negativa", "com a base zero não há variação percentual";
`tests/unit/test_business_lastro.py`, "aceita a comparação"; integração,
`tests/integration/test_business_query.py`, "a comparação de cada Métrica bate com o SQL à mão"
(parametrizado, com e sem o filtro de vendedor).

### CA2

**Marca:** teste de unidade

**Cenário:** Dado a lista de nomes de uma tabela, quando o código procura "ana", "ANA" ou "Âna",
então acha os dois vendedores com "Ana" no nome, por trecho e sem diferença de maiúsculas e acentos;
"ana paula ramos" acha só a Ana Paula Ramos (o nome completo igual vence os trechos); e "Silva"
acha os seis clientes.

**Teste previsto:** unidade, `tests/unit/test_business_names.py`, "acha por trecho sem maiúsculas
nem acentos" (parametrizado), "o nome completo igual vence os trechos" e "acha todos os que têm o
trecho".

### CA3

**Marca:** teste de integração

**Cenário:** Dado o `business_test` carregado e um Pedido com Permissão de dados, quando a ferramenta
consulta pedidos do vendedor "Zé", então grava "Não encontrei vendedor Zé." com a marca
(`not_found`); do vendedor "Ana", grava a pergunta "Qual Ana?" com as Respostas prontas "Ana Beatriz
Costa" e "Ana Paula Ramos", com a marca (`ambiguous_name`), e marca o Pedido como respondido pela
pergunta; e do cliente "Silva", grava "Há mais de cinco clientes com Silva. Diga um nome mais
completo." com a marca (`too_generic`). Nenhum dos três consulta a Métrica.

**Teste previsto:** integração, `tests/integration/test_business_query.py`, "nome sem achado grava
não encontrei", "nome repetido grava a pergunta com os nomes completos" e "nome genérico demais pede
um nome mais completo".

### CA4

**Marca:** teste de integração

**Cenário:** Dado o nome completo escolhido numa Resposta pronta ("Ana Paula Ramos"), quando a
ferramenta consulta os pedidos dela em junho de 2026, então a `reply` traz o número do SQL à mão
filtrado pela vendedora e "vendedor Ana Paula Ramos" no título e na linha do que foi considerado; e,
com o modelo real, a continuação "Ana Paula Ramos" depois da pergunta "Qual Ana?" grava a resposta
filtrada.

**Teste previsto:** integração, `tests/integration/test_business_query.py`, "o nome completo
responde com a consulta filtrada"; `tests/integration/test_request_business.py`, "a continuação com
o nome completo responde a consulta filtrada" (modelo real).

### CA5

**Marca:** documento

**Cenário:** Quem revisa confere que os testes de CA1 a CA4 existem: os de unidade da variação, da
base zero e da busca sem acento, e os de integração da comparação e do filtro contra o SQL à mão, dos
três desfechos de nome e da continuação.

### CA6

**Marca:** documento

**Cenário:** Quem revisa abre o LLD e encontra a busca por nome em `app/business/` como `existe`, a
comparação e o filtro em "6.6 Consulta a dados de negócio" e `business_data` na ação `question`
usada pelo Serviço de agentes.

## Contrato

### POST /v1/bot/requests/:id/question (cliente do Serviço de agentes) · alterada

O `ChatApiClient.question` passa a mandar `business_data` (a rota o aceita desde a F13-T02). A rota
não muda.

O contrato da API, dos eventos e das tabelas não muda: os desfechos `not_found`, `ambiguous_name` e
`too_generic` já estão no `CHECK` da `business_queries` (F13-T04).

## Verificação do contrato

- `question` com `business_data`: CA3.
- Os três desfechos de nome na `business_queries`: CA3.

## Decisões

- `consultar_dados` ganha `comparar_inicio`, `comparar_fim`, `filtro_tipo` (`cliente`, `vendedor` ou
  `produto`) e `filtro_nome`, opcionais. Só um dos dois de comparação, ou só um dos dois de filtro,
  volta ao modelo como `erro`.
- O filtro vale onde faz sentido nos dados: `vendedor` em todas as Métricas de pedidos
  (faturamento, pedidos, ticket médio, clientes ativos, itens vendidos); `cliente` em faturamento,
  pedidos, ticket médio e itens vendidos; `produto` em pedidos (pedidos pagos que têm o produto) e
  itens vendidos (unidades do produto). As outras combinações voltam ao modelo como `erro`, e o
  modelo dá a recusa curta.
- A busca (`names.py`) lê `id` e `name` da tabela do tipo, normaliza em Python (NFKD sem marcas e
  `casefold`) e procura o trecho; um nome normalizado igual ao procurado vence os trechos. De 2 a 5
  achados, a pergunta; mais de 5, o pedido de nome mais completo (`MAX_NAME_OPTIONS = 5`).
- A pergunta de nome usa o texto "Qual {nome}?" com o nome como a Pessoa escreveu, marca o Pedido
  como respondido por pergunta (`question`) e grava `business_data`, porque lista nomes do
  cadastro. Numa continuação, o nome ainda repetido não pergunta de novo: grava "Não consegui
  identificar {tipo} {nome}. Mencione o Agente de novo com o nome completo." com a marca, como os
  outros desfechos de nome (`ambiguous_name`).
- A comparação consulta os dois períodos com a mesma Métrica e o mesmo filtro; a variação é
  `(atual − base) / base`, em percentual arredondado a uma casa, com o sinal sempre escrito. Com a
  base zero, ou no ticket médio com um dos períodos sem pedidos, não há variação, e o texto diz
  "Sem variação percentual: a base é zero." ou "Sem variação percentual: um dos períodos não tem
  pedidos pagos.". Nas Métricas de soma e contagem, um período vazio vale zero.
- O título leva o filtro entre parênteses ("Pedidos pagos (vendedor Ana Paula Ramos) em junho de
  2026: 12."), e a linha do que foi considerado também ("Considerado: pedidos pagos, vendedor Ana
  Paula Ramos, de …").
- O lastro da comparação aceita os dois valores, o módulo da variação e as datas dos dois períodos.

## Arquivos e interfaces

- `app/business/names.py`: `normalized(text)`, `matching(rows, query)`, `find(store, kind, name)`.
- `app/business/catalog.py`: `Filter`, `query_for(..., filter=None)`.
- `app/business/answer.py`: `answer_text(..., filter_label=None, comparison=None)`,
  `variation(current, base)`, textos dos desfechos de nome.
- `app/business/consult.py`: os parâmetros novos, a resolução do nome e a comparação.
- `app/chat_api.py`: `question(..., business_data=False)`.
- `app/agents/assistente/tools.py` (assinatura e docstring) e `instructions.py` (comparação e
  filtro).
- `tests/unit/test_business_names.py`, `test_business_answer.py`, `test_business_lastro.py`;
  `tests/integration/test_business_query.py`, `test_request_business.py`.

## Testes existentes que mudam

Nenhum: as assinaturas novas são opcionais.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra a busca por nome como `planejada` em `app/business/` e
o `business_data` da `question` em "Interfaces". No fim da tarefa, a seção 6.6 ganha a comparação e o
filtro pela skill `lld`.
