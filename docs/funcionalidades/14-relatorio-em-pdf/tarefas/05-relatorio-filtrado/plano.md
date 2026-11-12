# Plano da F14-T05: Relatório filtrado por cliente, vendedor ou produto

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de integração

**Cenário:** Dado `gerar_relatorio` chamado direto com um filtro, com a API do chat falsa, o Banco
de negócio de teste e o Redis de teste: um nome sem achado ("vendedor Zé Ninguém") grava
"Não encontrei vendedor Zé Ninguém." com a marca e audita `not_found`; "cliente Silva", com mais de
cinco achados, grava o pedido de um nome mais completo com a marca e audita `too_generic`;
"vendedor Ana", com dois achados, grava a Pergunta pendente "Qual Ana?" com um botão por nome
completo e a marca e audita `ambiguous_name`; numa continuação, o mesmo nome repetido grava "Não
consegui identificar…" sem perguntar de novo; em todos, a trava da Pessoa está solta depois e
nenhum Aviso de início é gravado; um filtro sem nome, ou um tipo fora de `cliente`, `vendedor` e
`produto`, volta ao modelo como `erro`.

**Teste previsto:** integração, `tests/integration/test_report_request.py`, "um nome sem achado
grava não encontrei e solta a trava", "um nome genérico demais pede um nome mais completo", "um
nome repetido pergunta qual, com um botão por nome", "na continuação o nome repetido não pergunta de
novo" e "filtro incompleto volta ao modelo como erro".

### CA2

**Marca:** teste de integração

**Cenário:** Dado `gerar_relatorio` com "vendedor Ana Paula Ramos", quando o nome tem um achado só,
então o job na fila leva `filter: {type: "vendedor", id: <id dela>, name: "Ana Paula Ramos"}`, e o
Worker, com esse job, gera o PDF com as Métricas da vendedora e "não se aplica" em Clientes novos
(o gabarito com filtro de vendedor já está em `test_worker_job.py`, da tarefa 03, e ganha o caso de
produto: só Pedidos e Itens vendidos filtrados).

**Teste previsto:** integração, `tests/integration/test_report_request.py`, "um nome com um achado
leva o filtro pelo id ao job"; `tests/integration/test_worker_job.py`, "com filtro de produto, só
Pedidos e Itens vendidos se aplicam".

### CA3

**Marca:** teste de unidade

**Cenário:** Dado um período e o filtro "vendedor Ana Paula Ramos", quando o código monta o Aviso de
início, então ele é "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026, vendedor Ana Paula
Ramos. Ele chega aqui quando ficar pronto."; o título do PDF traz "Março de 2026 · vendedor Ana
Paula Ramos" e o nome do arquivo termina em `-vendedor-ana-paula-ramos.pdf` (provados em
`test_report_pdf.py`, da tarefa 03). Um Pedido real com o modelo, "@assistente relatório de março de
2026 em PDF da vendedora Ana Paula Ramos", grava esse aviso.

**Teste previsto:** unidade, `tests/unit/test_report_notice.py`, "o aviso traz o filtro" e "sem
filtro, o trecho some"; integração, `tests/integration/test_request_report.py`, "um Pedido real de
Relatório filtrado grava o aviso com o filtro".

### CA4

**Marca:** documento

**Cenário:** Os testes de CA1 a CA3 existem e passam; quem revisa encontra o PDF filtrado conferido
contra o gabarito em `test_worker_job.py`.

### CA5

**Marca:** documento

**Cenário:** Quem revisa abre o `docs/lld.md` e encontra o filtro por nome do Relatório como
`existe` na seção "Consulta a dados de negócio".

## Contrato

O contrato da API do chat, das tabelas e da fila não muda.

### Ferramenta `gerar_relatorio` · alterada (para o modelo)

Antes: `gerar_relatorio(inicio, fim)`. Depois: `gerar_relatorio(inicio, fim, filtro_tipo?,
filtro_nome?)`, com `filtro_tipo` em `cliente`, `vendedor` ou `produto` e `filtro_nome` como está no
pedido, os dois juntos.

## Verificação do contrato

- Os parâmetros novos e as saídas de nome: CA1; o filtro na carga: CA2.

## Decisões

- `filtro_tipo` usa os mesmos valores da `consultar_dados` (`cliente`, `vendedor`, `produto`), e não
  `customer`, `seller` e `product`, como a spec escreve: o modelo já os usa na F13, a carga do job
  já os usa (tarefa 03) e não há tradução no caminho. A spec ganha essa correção no commit de plano.
- A resolução do nome reaproveita a da F13: `consult._resolve_name` passa a `resolve_name`, pública,
  e a ferramenta do Relatório a chama com os callbacks dela, que soltam a trava antes de gravar a
  saída. A Pergunta pendente de nome é a mesma da F13, com a marca.
- Na continuação depois da pergunta de nome, as instruções mandam chamar `gerar_relatorio` de novo
  com o mesmo período e o nome completo.
- A recusa por filtro incompleto volta ao modelo como `erro`, como os outros parâmetros inválidos,
  antes da trava.

## Arquivos e interfaces

- `apps/agents/app/business/consult.py`: `resolve_name` pública.
- `apps/agents/app/business/report_request.py`: o passo do filtro.
- `apps/agents/app/agents/assistente/tools.py`: `filtro_tipo`, `filtro_nome`.
- `apps/agents/app/agents/assistente/instructions.py`: o filtro no Relatório e a continuação do
  nome.
- Testes: `tests/unit/test_report_notice.py`, `tests/integration/test_report_request.py`,
  `tests/integration/test_worker_job.py`, `tests/integration/test_request_report.py`.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

- `docs/funcionalidades/14-relatorio-em-pdf/spec.md`, seção "Ferramenta `gerar_relatorio`": os
  valores de `filtro_tipo` passam a `cliente`, `vendedor` e `produto`, os da F13.
