# Plano da F14-T04: Pedir o Relatório de um período ao Agente

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de unidade

**Cenário:** Dado um período pedido e o dia de hoje no fuso da empresa, quando o código calcula o
período anterior, então: março de 2026 inteiro → fevereiro de 2026 inteiro; o 1º trimestre de 2026
→ o 4º de 2025; 2025 inteiro → 2024 inteiro; 10/03 a 19/03 → 28/02 a 09/03 (os mesmos 10 dias
antes); 01/11/2026 a 12/11/2026 com hoje 12/11 → 01/10 a 12/10; um período que passa de hoje é
cortado em hoje (01/11 a 30/11 com hoje 12/11 → 01/11 a 12/11 contra 01/10 a 12/10); 01/03 a 31/03
com hoje 31/03 → fevereiro inteiro, cortado no último dia dele; janeiro → dezembro do ano anterior;
março de 2024 → fevereiro de 2024 com 29 dias; 01/03/2025 a 30/03/2025 em andamento → 01/02 a
28/02 (cortado no mês mais curto).

**Teste previsto:** unidade, `tests/unit/test_periods.py`, um caso por linha acima.

### CA2

**Marca:** teste de integração

**Cenário:** Dado a ferramenta chamada direto, com a API do chat falsa, o Redis de teste e o
Banco dos agentes de teste: sem Permissão de dados, grava a recusa da F13 como `reply` sem a marca,
audita `no_permission` com `kind = 'report'` e não toca a trava; com datas inválidas ou início
depois do fim, devolve `erro` ao modelo, sem auditoria nem ação; com a trava da Pessoa presa por
outro Pedido, grava "Já tem um relatório seu sendo gerado. Ele chega na conversa onde foi pedido."
como `reply` sem a marca, sem auditoria, e a trava continua do outro Pedido; no caminho certo, grava
o Aviso de início pela `report-started`, com o texto do período, antes de o job existir na fila, e
depois o job está na fila com o id do Pedido, a trava presa com o id do Pedido e o período anterior
na carga; se enfileirar falha, grava `report-failed`, solta a trava e audita `error`; e em todos os
casos que gravam, a vez do modelo termina (`skip_summarization` e o desfecho `report`).

**Teste previsto:** integração, `tests/integration/test_report_request.py`, "sem Permissão de dados
grava a recusa e audita sem prender a trava", "datas inválidas voltam ao modelo como erro", "com a
trava presa grava a recusa de Relatório em andamento", "o aviso é gravado antes de o job entrar na
fila" e "uma falha ao enfileirar grava report-failed e solta a trava".

### CA3

**Marca:** teste de integração

**Cenário:** Dado um Pedido sem período ("@assistente me manda um relatório em PDF"), quando o
modelo real o atende, então grava a pergunta de período com as Respostas prontas da F13; e, na
continuação com "Mês passado", grava o Aviso de início do mês passado. A avaliação da tarefa 07
cobre as variações de escrita.

**Teste previsto:** integração, `tests/integration/test_request_report.py`, "sem período, o Agente
pergunta e a continuação gera o Relatório".

### CA4

**Marca:** documento

**Cenário:** Quem revisa abre `app/agents/assistente/instructions.py` e encontra: o Pedido só é
Relatório quando pede relatório ou PDF de forma explícita; pergunta de número vai para
`consultar_dados`; sem período, `perguntar_periodo`, e a continuação completa o Relatório; o que o
Relatório traz; Relatório com lista, ranking, série, gráfico, contato ou alteração recebe a recusa
curta; e a recusa curta passa a dizer que o Agente também gera relatórios em PDF dos números de
vendas e o que eles trazem.

### CA5

**Marca:** teste de integração

**Cenário:** Dado o app real com o modelo real, o Banco de negócio de teste, a API do chat falsa e o
S3 do contêiner, quando chega o Pedido "@assistente me manda um relatório de março de 2026 em PDF"
de quem tem Permissão de dados, então a API falsa recebe o Aviso de início de 01/03/2026 a
31/03/2026, o job está na fila e, rodando o job com o Worker, a API falsa recebe a entrega com o
PDF de março no S3. Os casos da ferramenta sem o modelo estão em CA2.

**Teste previsto:** integração, `tests/integration/test_request_report.py`, "um Pedido real de
Relatório grava o aviso e o Worker entrega o PDF".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` conectado com o bot criado, o Banco de negócio carregado, o Serviço
de agentes e o Worker rodando, a Ana com Permissão de dados e o Bruno sem, num Canal, quando a Ana
pede "@assistente me manda um relatório de março de 2026 em PDF", então ela vê o Aviso de início,
envia outra Mensagem, vê a entrega com o cartão e baixa um arquivo que começa com `%PDF`; o Bruno vê
o aviso e a entrega como Resposta bloqueada, sem recarregar.

**Teste previsto:** Playwright, `e2e/agentes/relatorio-pdf.spec.ts`, "a Pessoa com permissão pede o
Relatório, segue conversando e baixa o PDF".

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre o `docs/lld.md` e encontra a ferramenta `gerar_relatorio`, o período
anterior e a trava como `existe`.

## Contrato

O contrato da API do chat e das tabelas não muda. A ferramenta e a carga do job seguem a spec
("Ferramenta `gerar_relatorio`") e a tarefa 03 ("Job `generate_report`").

### Ferramenta `gerar_relatorio` · nova (para o modelo)

`gerar_relatorio(inicio: str, fim: str)`: datas `AAAA-MM-DD`, os dois dias inclusive. Devolve a
confirmação de que o aviso foi gravado, ou `erro` com o parâmetro a corrigir. O filtro
(`filtro_tipo`, `filtro_nome`) entra na tarefa 05.

## Verificação do contrato

- A ordem e as saídas da ferramenta: CA2.
- O job na fila, com o `job_id` e o período anterior: CA2 e CA5.

## Decisões

- O período anterior fica em `app/business/periods.py`, `report_periods(start, end, today) ->
  (período, anterior)`: corta o fim em hoje; reconhece o mês, o trimestre e o ano pelo início
  alinhado e pelo fim dentro da mesma unidade, inteiro (fim no último dia) ou em andamento (fim em
  hoje); a unidade inteira compara com a anterior inteira, e a em andamento com o mesmo número de
  dias a partir do início da anterior, cortado no último dia dela; o resto compara com os mesmos `n`
  dias antes. "Este mês" das instruções (do dia 1 até hoje) cai no mês em andamento.
- A lógica fica em `app/business/report_request.py` (`request_report`), e a ferramenta em
  `tools.py` só busca as dependências, como `consultar_dados`.
- A fila do Relatório é um `ArqRedis` próprio do Serviço de agentes, criado no `create_app` com os
  mesmos tempos curtos do limite de pedidos, posto no Pedido por um `ContextVar`
  (`CURRENT_REPORTS`) como o cliente da API do chat e o Banco de negócio; ele também prende a trava.
- O Aviso de início: "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026. Ele chega aqui quando
  ficar pronto.", com as datas do período já cortado em hoje.
- A recusa sem permissão e a de Relatório em andamento saem como `reply` sem a marca; a recusa sem
  permissão audita `no_permission` com `kind = 'report'`; a de Relatório em andamento não audita,
  porque não toca o banco.
- `mark_answered` ganha o desfecho `report`, para o fim do Pedido não gravar outra `reply`.
- A trava é presa antes do aviso e solta pela ferramenta só quando enfileirar falha; depois de
  enfileirado, só o Worker a solta.
- Um Pedido de Relatório sem Permissão de dados não pergunta o período antes: a ferramenta recusa
  pela permissão, que ela confere primeiro, e as instruções mandam chamar `gerar_relatorio` mesmo
  sem saber se a Pessoa tem permissão (ela não sabe).
- A recusa curta da F13 ganha a frase sobre o Relatório em PDF; o texto exato fica em
  `instructions.py`, e a avaliação da tarefa 07 o confere por rubrica.

## Arquivos e interfaces

- `apps/agents/app/business/periods.py`: `report_periods`.
- `apps/agents/app/business/report_request.py`: `request_report`, `notice_text`, `REPORT_IN_PROGRESS`.
- `apps/agents/app/business/report_queue.py`: `CURRENT_REPORTS`.
- `apps/agents/app/agent_requests/context.py`: desfecho `report`.
- `apps/agents/app/agent_requests/execution.py`: `ExecutionDeps.reports`, `CURRENT_REPORTS.set`.
- `apps/agents/app/fast_api_app.py`: a fila do Relatório.
- `apps/agents/app/agents/assistente/tools.py` e `agent.py`: `gerar_relatorio`.
- `apps/agents/app/agents/assistente/instructions.py`: a seção do Relatório e a recusa.
- Testes: `tests/unit/test_periods.py`, `tests/integration/test_report_request.py`,
  `tests/integration/test_request_report.py`; `apps/web/e2e/agentes/relatorio-pdf.spec.ts` e o
  plano de testes da F14.

## Testes existentes que mudam

- Os testes que conferem o texto da recusa curta da F13, se algum conferir o texto exato, passam a
  ver a frase nova.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra a ferramenta, o período anterior e a trava pela spec.
A passagem a `existe` entra no fim da tarefa (CA7).
