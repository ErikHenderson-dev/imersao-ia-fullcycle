# Plano da F14-T03: Worker gera e entrega o PDF de um período

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre o `compose.yaml` e encontra o serviço `worker`, com a mesma imagem e o
mesmo volume do `agents`, parado como os outros apps, dependente de `postgres`, `redis` e `s3`, com
`CHAT_WORKER_TOKEN`, `S3_CREATE_BUCKET=true` e as variáveis de S3, e sem `CHAT_BOT_TOKEN`,
`GEMINI_API_KEY` (sem o `env_file`) e `SESSION_SERVICE_URI`; abre o `AGENTS.md` raiz e o
`apps/agents/AGENTS.md` e encontra o comando
`docker compose -f compose.yaml exec worker uv run arq app.worker.WorkerSettings`; e o
`config.py` tem um `WorkerConfig` só com o que o Worker exige. O teste de unidade
`tests/unit/test_config.py`, "a configuração do Worker não exige a chave do modelo nem a credencial
de bot" e "a configuração do Worker falha sem o CHAT_WORKER_TOKEN", prova a separação.

### CA2

**Marca:** teste de unidade

**Cenário:** Dado uma carga de job com Pedido, Pessoa, Conversa, texto, os dois períodos em ISO, o
filtro (`{type, id, name}` ou nulo) e o instante do Pedido, quando ela vai ao Redis e volta, então
volta igual; a chave da trava de uma Pessoa é `reports:active:<id da Pessoa>`. O enfileiramento com
o id do Pedido como `job_id` é provado na integração de CA7 ("o mesmo Pedido enfileirado duas vezes
gera um job só").

**Teste previsto:** unidade, `tests/unit/test_report_job.py`, "a carga do job vai e volta pelo
dicionário" e "a chave da trava é por Pessoa".

### CA3

**Marca:** teste de unidade

**Cenário:** Dado um período, o fuso da empresa e, ou não, um filtro, quando o Worker monta a
consulta das seis Métricas, então ela é um único `SELECT` que passa pela conferência de somente
leitura do `readonly.py`; com filtro de vendedor, a consulta não traz Clientes novos (não se aplica)
e traz as outras cinco; com filtro de produto, só Pedidos e Itens vendidos; e as variações seguem a
F13: base zero sem variação, período sem pedidos pagos com o Ticket médio vazio e as somas em zero.
A integração de CA7 prova a consulta contra o banco, com o usuário só leitura e o tempo limite.

**Teste previsto:** unidade, `tests/unit/test_report_metrics.py`, "a consulta das seis Métricas é
um SELECT só de leitura", "o filtro de vendedor deixa Clientes novos de fora", "o filtro de produto
só vale para Pedidos e Itens vendidos" e "as linhas seguem a variação da F13".

### CA4

**Marca:** teste de unidade

**Cenário:** Dado o Relatório de março de 2026 com e sem filtro, quando o Worker monta o PDF, então
o texto extraído pelo pypdf traz "Relatório de vendas", o período e o filtro, "Gerado em … às …
(America/Sao_Paulo)", as datas dos dois períodos, as seis linhas da tabela na ordem do catálogo, "O
que cada Métrica considera" e "Página 1 de 1"; dois PDFs do mesmo Relatório com o mesmo instante de
geração são iguais byte a byte; o nome do arquivo é
`relatorio-2026-03-01-a-2026-03-31.pdf` sem filtro e `…-vendedor-ana-souza.pdf` com filtro, sem
acento. O layout é conferido com o frame `Relatório / PDF / Março de 2026` do Figma, desenhado antes
do código, em `validacao-pdf.md` na pasta da tarefa.

**Teste previsto:** unidade, `tests/unit/test_report_pdf.py`, "o PDF traz o título, as datas, a
tabela e as definições", "o mesmo Relatório gera o mesmo PDF" e "o nome do arquivo segue a spec".

### CA5

**Marca:** teste de unidade

**Cenário:** Dado o PDF de um Relatório, quando o lastro confere o texto extraído contra os números
das consultas, então aceita; quando um valor do resultado é adulterado antes de montar o PDF (o PDF
traz um número que não está no resultado), então recusa; e, no job, sem lastro, o Worker grava
`report_failed`, audita `lastro_blocked`, solta a trava e não grava nada no S3 (integração de CA7).

**Teste previsto:** unidade, `tests/unit/test_report_pdf.py`, "o lastro aceita o PDF com os
números do resultado" e "o lastro recusa um número adulterado"; integração,
`tests/integration/test_worker_job.py`, "sem lastro, nada é entregue".

### CA6

**Marca:** teste de integração

**Cenário:** Dado um job de março de 2026, quando o Worker o executa, então o PDF está no S3 do
contêiner em `reports/<id do Pedido>.pdf`, com `application/pdf`; a auditoria tem uma linha
`kind = 'report'` e `outcome = 'delivered'`, com os dois SQLs, gravada antes do `report-delivered`
(a API falsa vê a entrega e a linha já existe quando ela chega); a trava da Pessoa, presa com o id
do Pedido, sumiu; e uma trava de outro Pedido continua lá. A migração do Alembic aplica `kind` e o
desfecho `delivered`.

**Teste previsto:** integração, `tests/integration/test_worker_job.py`, "o job grava o PDF no S3,
audita e entrega", "a trava de outro Pedido fica" e "o bucket é criado na subida com
S3_CREATE_BUCKET".

### CA7

**Marca:** teste de integração

**Cenário:** Dado o Banco de negócio de teste com os dados fixos, a API do chat falsa e o S3 do
contêiner, quando o job de março de 2026 roda sem filtro e com o filtro de um vendedor, então o
texto extraído do PDF gravado traz, para cada Métrica, o valor de março, o de fevereiro e a
variação iguais aos calculados no teste por SQL próprio, independente do catálogo; com o filtro de
vendedor, Clientes novos traz "não se aplica"; julho de 2026, sem pedidos, mostra o Ticket médio
"sem pedidos pagos" e as somas em zero; e o mesmo Pedido enfileirado duas vezes gera um job só.

**Teste previsto:** integração, `tests/integration/test_worker_job.py`, "o PDF de março traz as
seis Métricas do gabarito", "com filtro de vendedor, Clientes novos não se aplica", "um período sem
pedidos pagos mostra zero e sem pedidos pagos" e "o mesmo Pedido enfileirado duas vezes gera um job
só".

### CA8

**Marca:** documento

**Cenário:** Quem revisa abre o `docs/lld.md` e encontra o Worker, a fila, a geração do PDF, a
coluna `kind` e o desfecho `delivered` da auditoria e o serviço `worker` como `existe`, e o
`app/worker/` na estrutura do código.

## Contrato

### business_queries · agentes · alterada

- Coluna nova `kind`: `text`, não nula, padrão `'answer'`; CHECK `business_queries_kind_check`
  `kind IN ('answer', 'report')`.
- CHECK `business_queries_outcome_check`: antes, os sete desfechos da F13; depois, os mesmos mais
  `delivered`.
- Na migração `0003_report_audit` do Alembic, gerada pelos metadados e conferida à mão.

### Job `generate_report` · fila arq · novo

| Item | Descrição |
| --- | --- |
| Fila | arq, no Redis do Serviço de agentes (`REDIS_URL`, banco 0), fila padrão |
| `job_id` | O id do Pedido |
| Carga | Um dicionário: `request_id`, `requester_id`, `conversation_id`, `question` (texto, só para a auditoria), `period` e `previous_period` (`{start, end}` em ISO), `filter` (`{type, id, name}`, com `type` em `cliente`, `vendedor` ou `produto`, ou nulo), `requested_at` (ISO com fuso) |
| Efeito | PDF no S3, auditoria e `report-delivered`, ou `report-failed` sem lastro |

### Chave `reports:active:<id da Pessoa>` · Redis · nova

Valor: o id do Pedido; validade: a validade da trava do Relatório; apagada pelo Worker só quando o
valor ainda é o id do Pedido dele (script Lua de comparar e apagar).

### Objeto `reports/<id do Pedido>.pdf` · S3 · novo

`ContentType: application/pdf`, no bucket `S3_BUCKET`; uma nova gravação substitui o arquivo.

### Variáveis do Worker · novas

`CHAT_WORKER_TOKEN`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` e
`S3_CREATE_BUCKET` (booleano, padrão falso), além de `DATABASE_URL`, `CHAT_API_URL`, `REDIS_URL`,
`BUSINESS_DATABASE_URL`, `BUSINESS_TIME_ZONE` e `BUSINESS_QUERY_TIMEOUT_MS`, já existentes.

## Verificação do contrato

- `kind` e `delivered`: CA6 (linha gravada pelo job).
- Job e `job_id`: CA2 e CA7.
- Trava: CA2 (chave) e CA6 (soltar só a própria).
- Objeto no S3: CA6.
- Variáveis do Worker: CA1.

## Decisões

- O filtro da carga usa os tipos do catálogo da F13 (`cliente`, `vendedor`, `produto`); a tarefa
  04 traduz o `filtro_tipo` da ferramenta para eles ao enfileirar, e o Worker não traduz nada.
- A consulta de um período é um `SELECT` com uma subconsulta agregada por Métrica que se aplica,
  cada uma a do `catalog.py` (`query_for`), unidas por produto cartesiano de linhas únicas, com as
  colunas `<métrica>_value` e `<métrica>_base`; a Métrica que não se aplica ao filtro fica fora do
  `SELECT`, e a linha dela mostra "não se aplica".
- Os valores seguem a F13: `rounded` e `comparable` do `answer.py`; sem pedidos pagos, as somas e
  contagens valem zero e o Ticket médio fica "sem pedidos pagos"; a variação é a `variation` da F13,
  e sem variação a coluna diz "sem variação percentual".
- As definições de "O que cada Métrica considera" são o `considered` do `WORDING` da F13, com a
  janela dos Clientes ativos dita sem número ("clientes distintos com pedido pago nos três meses até
  o fim do período"), para nenhum número sem lastro entrar no PDF.
- O PDF tem uma página A4; o rodapé "Página 1 de 1" usa o total de páginas do fpdf2. O lastro aceita
  os números do resultado, as variações, o dia, o mês e o ano das quatro datas dos períodos e da
  geração, a hora e o minuto da geração, os números do nome do fuso e os números da paginação.
- Determinismo: `set_creation_date` com o instante do Pedido e o produtor fixo "Full Cycle Chat";
  a data de geração do texto é o instante em que o job roda, no fuso da empresa.
- O nome do arquivo tira acentos por `unicodedata` e troca o que não é letra ou algarismo por
  hífen: `relatorio-<início>-a-<fim>[-<tipo>-<nome>].pdf`.
- O cliente da API do chat ganha `report_started`, `report_delivered` e `report_failed`; o Worker
  usa uma instância com o `CHAT_WORKER_TOKEN`. Os testes usam a API falsa da F11.
- A trava e o enfileiramento ficam em `app/business/report_queue.py`: `lock_key`, `acquire_lock`,
  `release_lock` e `enqueue_report` (este, usado pela ferramenta da tarefa 04). O Worker só solta a
  trava.
- Nesta tarefa, o job trata o caminho de sucesso e o sem lastro; qualquer outra exceção sobe e o
  arq a registra. As novas tentativas, o `report_failed` final e o encerramento por Pedido recusado
  são da tarefa 06, que ajusta `max_tries`, a espera e o tempo limite do `WorkerSettings`.
- O `config.py` ganha `WorkerConfig` (o que o Worker exige) e `load_worker_settings`; o `Settings` do
  Serviço de agentes não muda.
- O S3: boto3 com `endpoint_url`, `addressing_style: path`, `put_object` em
  `asyncio.to_thread`; com `S3_CREATE_BUCKET`, o `on_startup` do Worker cria o bucket se ele não
  existe.
- O frame do PDF no Figma (`Relatório / PDF / Março de 2026`, 595 × 842, a escala do A4 em pontos)
  entra antes do código, na seção "Relatório em PDF (F14)".

## Arquivos e interfaces

- `apps/agents/pyproject.toml` e `uv.lock`: `arq`, `fpdf2`, `boto3`; `pypdf` (também no Worker, para
  o lastro).
- `apps/agents/app/config.py`: `WorkerConfig`, `load_worker_settings()`.
- `apps/agents/app/chat_api.py`: `report_started`, `report_delivered`, `report_failed`.
- `apps/agents/app/business/audit.py`: `kind` e `delivered`; `record(..., kind=)`.
- `apps/agents/migrations/versions/0003_report_audit.py`.
- `apps/agents/app/business/report_queue.py`: `ReportJob` (`to_payload`, `from_payload`),
  `lock_key`, `acquire_lock`, `release_lock`, `enqueue_report`.
- `apps/agents/app/worker/__init__.py`: `WorkerSettings`.
- `apps/agents/app/worker/job.py`: `generate_report(ctx, payload)` e `run_report(deps, job, now)`.
- `apps/agents/app/worker/metrics.py`: `metrics_query`, `MetricRow`, `report_rows`.
- `apps/agents/app/worker/pdf.py`: `build_pdf`, `file_name`, `pdf_text`, `report_allowed_numbers`.
- `apps/agents/app/worker/storage.py`: `ReportStorage` (`put_pdf`, `ensure_bucket`).
- `apps/agents/app/worker/fonts/`: `Lato-Regular.ttf`, `Lato-Bold.ttf`, `OFL.txt`.
- `compose.yaml`: serviço `worker`; S3 no `agents`.
- `AGENTS.md` raiz e `apps/agents/AGENTS.md`: comando do Worker e testes.
- Testes: `tests/unit/test_report_job.py`, `test_report_metrics.py`, `test_report_pdf.py`,
  `test_config.py`; `tests/integration/test_worker_job.py`; `conftest.py` (API falsa aceita a
  rota de entrega, S3 de teste).

## Testes existentes que mudam

- `tests/unit/test_config.py` ganha os casos do Worker.
- Os testes da auditoria da F13 seguem iguais: a coluna `kind` tem padrão `answer`.

## Mudança de dados

Nenhuma: as linhas antigas da auditoria ficam com `kind = 'answer'` pelo padrão.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra o Worker, a fila, o PDF, a auditoria e o serviço como
`planejados`, pela spec. A passagem a `existe` entra no fim da tarefa (CA8).
