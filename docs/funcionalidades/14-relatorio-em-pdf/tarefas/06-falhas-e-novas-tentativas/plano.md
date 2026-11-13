# Plano da F14-T06: Falhas e novas tentativas do Relatório

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de integração

**Cenário:** Dado um job cujo primeiro upload ao S3 falha, quando o Worker roda a primeira
tentativa, então ela pede nova tentativa ao arq com a espera de 5 s (e a segunda falha, com 15 s),
sem gravar auditoria nem ação; quando a segunda tentativa roda e o S3 responde, então o PDF fica na
mesma chave, a auditoria tem uma linha só (`delivered`) e a API do chat recebe uma entrega só; e
uma tentativa que passa do tempo limite também volta à fila.

**Teste previsto:** integração, `tests/integration/test_worker_retries.py`, "uma falha no S3 e
sucesso na segunda tentativa entregam uma vez só, na mesma chave" e "uma tentativa que passa do
tempo limite volta à fila".

### CA2

**Marca:** teste de integração

**Cenário:** Dado um job cuja geração falha em toda tentativa, quando a terceira falha, então o
Worker grava `report-failed`, audita `error` com `kind = 'report'` e solta a trava, sem pedir nova
tentativa; e sem lastro, já na primeira, grava `report-failed`, audita `lastro_blocked` e solta a
trava, sem pedir nova tentativa (o caso sem lastro existe desde a tarefa 03 e ganha a conferência de
que não há nova tentativa).

**Teste previsto:** integração, `tests/integration/test_worker_retries.py`, "tentativas esgotadas
gravam report-failed, auditam error e soltam a trava" e "sem lastro não há nova tentativa".

### CA3

**Marca:** teste de integração

**Cenário:** Dado um job cujo Pedido a API do chat recusa na entrega com 404 `request_not_found`,
409 `request_closed` ou 410 `request_expired`, quando o Worker o roda, então o job termina sem nova
tentativa, sem `report-failed`, com o log do id do Pedido, e a trava fica solta.

**Teste previsto:** integração, `tests/integration/test_worker_retries.py`, "um Pedido recusado
encerra o job sem nova tentativa e solta a trava", parametrizado pelos três status.

### CA4

**Marca:** teste de integração

**Cenário:** Dado `gerar_relatorio` com a fila fora, quando enfileirar falha, então grava
`report-failed`, audita `error` e solta a trava. Já coberto pela tarefa 04,
`tests/integration/test_report_request.py`, "uma falha ao enfileirar grava report-failed e solta a
trava", que esta tarefa só confere.

### CA5

**Marca:** documento

**Cenário:** Os testes de CA1 a CA4 existem e passam.

### CA6

**Marca:** documento

**Cenário:** Quem revisa abre o `docs/lld.md` e encontra o job do Relatório em "Processos de segundo
plano" com as novas tentativas e o encerramento pelo Pedido recusado como `existe`.

## Contrato

O contrato não muda: o job, a carga, as ações e a auditoria são os da tarefa 03. O `WorkerSettings`
passa a ter `max_tries` 3 e o `job_timeout` folgado acima do tempo limite da tentativa.

## Verificação do contrato

Nenhum item novo de contrato.

## Decisões

- O tempo limite da tentativa é do próprio job: `asyncio.wait_for` com 20 s em volta de
  `run_report`, porque o arq marca o job estourado como falho, sem nova tentativa. O `job_timeout`
  do arq fica em 60 s, só como rede de segurança.
- A nova tentativa usa o `Retry(defer=...)` do arq: 5 s antes da segunda e 15 s antes da terceira,
  pela tentativa atual (`ctx["job_try"]`); `max_tries` é 3.
- Classificação da exceção de uma tentativa:
  - `ChatApiError` com 404, 409 `request_closed` ou 410 da entrega: o Pedido acabou; log com o id do
    Pedido, trava solta, sem nova tentativa e sem `report-failed`;
  - qualquer outra (S3, Banco de negócio, tempo limite, API do chat fora ou 5xx, auditoria): nova
    tentativa enquanto houver; na última, `report-failed`, auditoria `error` e trava solta.
- Na falha final, a trava solta primeiro e o `report-failed` e a auditoria vêm depois, cada um com o
  erro só no log se falhar, para nenhum deles impedir os outros.
- Uma tentativa que falha depois de gravar a auditoria `delivered` (a entrega respondeu 5xx) volta à
  fila e grava outra linha `delivered` na tentativa seguinte: a spec manda auditar antes da entrega,
  e o caso é raro; fica registrado aqui, sem desvio da spec.

## Arquivos e interfaces

- `apps/agents/app/worker/job.py`: `generate_report` com o tempo limite, as novas tentativas e a
  falha final; `retry_delay(job_try)`; `REQUEST_GONE`.
- `apps/agents/app/worker/__init__.py`: `max_tries`, `job_timeout`.
- Testes: `tests/integration/test_worker_retries.py`.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra as novas tentativas e o encerramento pelo Pedido
recusado como `planejados` (tarefa 03). A passagem a `existe` entra no fim da tarefa (CA6).
