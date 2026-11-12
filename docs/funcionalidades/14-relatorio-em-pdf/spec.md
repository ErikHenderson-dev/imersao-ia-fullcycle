# Spec · F14 · Relatório em PDF

2026-11-12 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F14 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

## Problema

Desde a F13 quem tem Permissão de dados pergunta um número por vez, e levar os números de um
período para fora da Conversa exige várias perguntas e cópia à mão (PRD, seção 1, "Resumo
executivo").

## Solução

A F14 reaproveita o Pedido da F11, a Pergunta pendente, o catálogo, a conferência de somente
leitura, o lastro, a auditoria e a Resposta bloqueada da F13. Sobre eles, ela acrescenta:

- uma ferramenta `gerar_relatorio` no `assistente`, que confere a permissão, a trava de um
  Relatório por vez e o filtro, grava o Aviso de início e põe o Pedido demorado na fila;
- o Worker de agentes, um processo separado do mesmo projeto, que consome a fila, consulta as seis
  Métricas nos dois períodos, monta o PDF, confere o lastro no texto do PDF, grava-o no
  armazenamento de objetos e o entrega pela API do chat, sem chamar o modelo
  ([ADR 0006](../../adr/0006-worker-separado.md), HLD, seção 6.5);
- três ações de bot novas na API do chat, para o Aviso de início, a entrega e a falha, com a
  validade do Pedido estendida e a Menção a quem pediu;
- a referência ao PDF na Mensagem e a rota de download, que confere a Permissão de dados no clique
  e devolve uma URL assinada;
- o cartão do Relatório no `web`.

O modelo só decide que o Pedido é um Relatório e escolhe o período e o filtro. Quem confere a
Permissão de dados, calcula o período anterior, monta as consultas, escreve o PDF, confere o lastro
e decide o bloqueio e o download é o código. O fluxo completo está no PRD, seção 2, "Fluxo".

## Histórias de usuário

As histórias 1 a 8 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá. Do ponto de vista de quem constrói e opera:

1. Como Serviço de agentes, quero gravar o Aviso de início e pôr o Pedido na fila sem esperar o
   PDF, para que o Pedido termine dentro do p95 de 5 s e a Conversa siga.
2. Como Worker, quero montar o PDF só a partir do resultado das consultas e conferir o lastro no
   texto do arquivo pronto, para que nenhum número sem lastro chegue a uma Pessoa.
3. Como Worker, quero tentar de novo uma geração que falhou sem duplicar o arquivo nem a entrega,
   para que uma falha passageira não vire "não consegui".
4. Como API do chat, quero conferir a Permissão de dados de quem clica em "Baixar" e assinar uma URL
   curta, para que o arquivo nunca saia para quem não tem permissão.
5. Como quem opera a instalação, quero ver cada Relatório registrado na auditoria, com as consultas
   e o desfecho, para auditar o acesso.

## Decisões de implementação

### Ferramenta `gerar_relatorio` (Serviço de agentes)

- **Assinatura:** `gerar_relatorio(inicio, fim, filtro_tipo?, filtro_nome?)`, em
  `app/agents/assistente/tools.py`, com a lógica num módulo novo `app/business/report_request.py`.
  O modelo nunca escolhe Métricas nem o período anterior.
- **Ordem**, cada passo que recusa encerra o Pedido com uma ação e, quando toca o banco ou a
  permissão, uma linha de auditoria com `kind = 'report'`:
  1. sem Permissão de dados, a recusa sem permissão da F13 como `reply` sem a marca
     (`no_permission`), sem tocar a trava nem o banco;
  2. parâmetros inválidos (datas ISO, início antes do fim, `filtro_tipo` em `customer`, `seller`
     ou `product`, nome não vazio quando há tipo) voltam ao modelo como erro, sem auditoria;
  3. a trava de um Relatório por vez ("Trava de um Relatório por vez"): já presa, grava como `reply`
     sem a marca "Já tem um relatório seu sendo gerado. Ele chega na conversa onde foi pedido.",
     sem auditoria, porque não toca o banco;
  4. com filtro, o nome é resolvido pelo `names.py` da F13, com as mesmas saídas e a marca:
     `not_found`, `ambiguous_name` (Pergunta pendente com um botão por nome completo) e
     `too_generic`. Cada saída solta a trava antes de gravar;
  5. o período anterior é calculado em código ("Período anterior");
  6. grava o Aviso de início pela ação `report_started`, com a marca, e só depois enfileira o job
     ("Fila e job"). A ordem garante que a entrega nunca chegue antes do aviso, que é o que estende
     a validade do Pedido;
  7. se enfileirar falhar, grava `report_failed` e solta a trava; a auditoria fica `error`.
- O passo 6 encerra a vez do modelo como as outras ferramentas que gravam (`mark_answered`). O fim
  do Pedido no Serviço de agentes acontece ali, e o "digitando" para pelo `typing.stop` que a API do
  chat emite na ação.
- Sem período, o Agente chama a `perguntar_periodo` da F13, e a continuação completa o Pedido de
  Relatório. Numa continuação, `gerar_relatorio` recebe o período escrito por quem pediu.
- **Texto do Aviso de início**, montado pelo código: "Comecei a gerar o relatório de 01/03/2026 a
  31/03/2026, vendedor Ana Souza. Ele chega aqui quando ficar pronto." Sem filtro, o trecho do
  filtro some. O microtexto final é conferido com o Figma na tarefa da tela.
- **Instruções do `assistente`**, além das da F13: o Pedido só é Relatório quando pede relatório ou
  PDF de forma explícita; uma pergunta de número continua indo para `consultar_dados`; Relatório com
  lista, ranking, série, gráfico, contato ou alteração recebe a recusa curta, que passa a dizer que
  o Agente também gera relatórios em PDF dos números de vendas e o que o Relatório traz.
- O teto de custo não muda: o Relatório completo é uma chamada ao modelo e uma à ferramenta.

### Período anterior

- O período anterior tem a mesma duração e termina no dia anterior ao início do período: para
  `[início, fim]` com `n` dias, é `[início − n dias, início − 1 dia]`. Um mês inteiro, porém, é
  comparado com o mês anterior inteiro (março → fevereiro), e um trimestre ou ano inteiros, com o
  anterior inteiro, porque a Pessoa lê "março contra fevereiro", e não "31 dias antes".
- Período em andamento (o fim é hoje ou depois): o fim é cortado em hoje, e o anterior é o mesmo
  trecho do período anterior, com o mesmo dia de início e o mesmo número de dias (01/11 a 12/11
  contra 01/10 a 12/10). Num mês anterior mais curto, o fim é cortado no último dia dele.
- Tudo no `Fuso da empresa`, com o intervalo `[início 00:00, fim + 1 dia 00:00)` da F13 (LLD,
  "Estados e regras", seção "Consulta a dados de negócio").
- É uma função pura em `app/business/periods.py`, coberta por testes de unidade com os casos acima,
  o fim de ano e o ano bissexto.

### Trava de um Relatório por vez (Serviço de agentes e Worker)

- Chave `reports:active:<id da Pessoa>` no Redis, gravada com `SET NX` e a `validade da trava do
  Relatório`, com o id do Pedido como valor.
- O Worker a apaga depois de gravar `report_delivered` ou o `report_failed` final, só se o valor
  ainda for o id do Pedido dele (um script Lua de comparar e apagar), para nunca soltar a trava de
  outro Relatório.
- Se o Worker morre sem apagar, a validade solta a Pessoa. Com o Redis fora, o Pedido já é recusado
  na rota (`agents_unavailable`).

### Fila e job (Serviço de agentes e Worker)

- **Biblioteca:** arq, com o Redis que o Serviço de agentes já usa, no banco 0, e o id do Pedido
  como `job_id`: enfileirar duas vezes o mesmo Pedido gera um job só.
- **Carga do job**, só dados já validados, nunca texto do Pedido para consulta:
  `request_id`, `requester_id`, `conversation_id`, `question` (o texto do Pedido, só para a
  auditoria), `period` e `previous_period` (datas ISO), `filter` (`{type, id, name}` ou nulo, com o
  id do cadastro já resolvido) e `requested_at`.
- **Novas tentativas:** até `tentativas do Worker`, com a `espera entre tentativas do Worker` e o
  `tempo limite da tentativa do Worker`. Uma tentativa que falha por exceção, tempo limite, banco de
  negócio fora ou erro do S3 volta à fila. Esgotadas, o Worker grava `report_failed`, audita `error`
  e solta a trava.
- Um erro da API do chat que diz que o Pedido acabou (404, 409 `request_closed`, 410
  `request_expired`) encerra o job sem nova tentativa, só com o log, e solta a trava.

### Worker de agentes

- **Processo:** módulo `app/worker/`, com `WorkerSettings` do arq e a função do job, rodado com
  `uv run arq app.worker.WorkerSettings`. Mesma imagem e mesmo `config.py` do Serviço de agentes; não
  recebe a chave do modelo nem a `SESSION_SERVICE_URI`, e o `config.py` passa a separar o que cada
  processo exige.
- **Credenciais:** um segredo próprio, `CHAT_WORKER_TOKEN`, que a API do chat aceita só nas rotas
  `report-delivered` e `report-failed` ("Ações de bot do Relatório"), com o alcance pelo Pedido; o
  Worker não recebe o `CHAT_BOT_TOKEN`, e um vazamento dele não grava respostas comuns. Também o
  `BUSINESS_DATABASE_URL` só leitura e o `DATABASE_URL` do Banco dos agentes, só para a auditoria.
- **Passos do job:**
  1. para cada período, uma consulta que calcula as seis Métricas de uma vez, montada a partir do
     `catalog.py` com o filtro por id, passando pela conferência de somente leitura do `readonly.py`
     e rodando com o `tempo limite da consulta ao Banco de negócio`. O filtro vale onde a F13 diz
     que ele faz sentido (LLD, "Estados e regras", seção "Consulta a dados de negócio"); numa
     Métrica em que não faz (clientes novos com filtro de vendedor, por exemplo), a linha fica sem
     consulta e mostra "não se aplica" nas três colunas de valor (PRD, "O que o relatório traz");
  2. calcula as variações como a F13: `(atual − base) / base`, com uma casa e sinal; base zero, sem
     variação;
  3. monta o PDF ("O PDF");
  4. extrai o texto do PDF com o pypdf e confere o lastro: todo número do texto está no resultado
     das consultas, nas variações calculadas delas, no dia, mês e ano das datas dos dois períodos e
     da data de geração, ou nos números do nome do fuso, pelo `lastro.py` da F13 com o conjunto
     ampliado. Sem lastro, grava `report_failed`, audita `lastro_blocked`, solta a trava e não tenta
     de novo;
  5. grava o PDF no S3 ("Armazenamento");
  6. grava a auditoria `delivered` e depois a ação `report_delivered`; se a auditoria falha, a
     tentativa falha e volta à fila;
  7. solta a trava.
- **Logs:** o id do Pedido em todos, como no Serviço de agentes, sem o resultado das consultas nem o
  conteúdo do PDF.

### O PDF

- **Biblioteca:** fpdf2, com a Lato do design system (400 e 700) embutida como TTF, em
  `app/worker/fonts/`, com a licença OFL ao lado. O texto sai selecionável.
- **Layout**, A4 retrato, conferido com o frame do Figma antes do código:
  - título "Relatório de vendas", com o período e o filtro na linha de baixo;
  - "Gerado em 12/11/2026 às 14:32 (America/Sao_Paulo)";
  - as datas exatas do período e do período anterior;
  - a tabela com as colunas Métrica, Período, Período anterior e Variação, uma linha por Métrica,
    na ordem do catálogo: Faturamento líquido, Pedidos, Ticket médio, Clientes ativos, Clientes
    novos, Itens vendidos;
  - abaixo, "O que cada Métrica considera", com a definição de cada uma igual à da linha do que foi
    considerado da F13;
  - rodapé com a página.
- **Formatos:** os do `answer.py` da F13 (moeda com R$ e duas casas, contagem inteira, percentual
  com uma casa e sinal). Sem pedidos pagos, o Ticket médio aparece como "sem pedidos pagos"; base
  zero, "sem variação percentual".
- **Determinismo:** a data de geração é a única parte variável; os metadados do PDF (data de criação
  e produtor) são fixados para o mesmo pedido gerar o mesmo conteúdo.
- **Nome do arquivo:** `relatorio-<início>-a-<fim>[-<tipo>-<nome>].pdf`, com as datas em ISO e o
  nome em kebab-case sem acento (`relatorio-2026-03-01-a-2026-03-31-vendedor-ana-souza.pdf`).

### Armazenamento (Worker e API do chat)

- **Chave** `reports/<id do Pedido>.pdf` no bucket `S3_BUCKET` (`reports`). Uma nova tentativa
  regrava a mesma chave, sem arquivo órfão. O nome do arquivo para a Pessoa vai no
  `Content-Disposition` da URL assinada, e não na chave.
- **Worker:** boto3, com o upload em `asyncio.to_thread`, uma chamada por Relatório, com
  `S3_ENDPOINT` (`http://s3:8333`), acesso por caminho e `ContentType: application/pdf`. Com
  `S3_CREATE_BUCKET` verdadeiro, só no desenvolvimento, cria o bucket na subida se ele não existir;
  em produção, o bucket é provisionado fora.
- **API do chat:** `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`, assinando com
  `S3_PUBLIC_ENDPOINT`, o endereço que o navegador alcança (LLD, "Ambiente de desenvolvimento",
  "Endereço do S3"), e a `validade da URL do PDF`.
- **Retenção:** o PDF fica enquanto a Mensagem existir; Mensagem de bot não é apagada por ninguém,
  então não há rotina de limpeza (PRD, "O que não é objetivo").

### Ações de bot do Relatório (API do chat)

- **Tipos novos** em `bot_actions`, numa migração que troca o CHECK: `report_started`,
  `report_delivered` e `report_failed`. Continuam valendo uma vez por Pedido, e a repetição devolve o
  que já foi gravado.
- **Regra de resposta única, com a exceção do Relatório:** `report_delivered` e `report_failed` só
  são aceitas num Pedido que já tem `report_started` (senão, `report_not_started`, 409), e são
  exclusivas entre si (a segunda recebe `request_closed`). `report_started` segue a regra de sempre:
  num Pedido já respondido, `request_closed`.
- **`POST /v1/bot/requests/:id/report-started`** `{ body }`: grava a Mensagem do Agente com a
  marca, estende o `expires_at` do Pedido para agora mais a `validade do identificador de pedido`
  do Pedido demorado e emite o fim do "digitando".
- **`POST /v1/bot/requests/:id/report-delivered`** `{ storage_key, file_name, size_bytes }`: numa
  transação, grava a Mensagem do Agente com a marca, o corpo "@<usuário de quem pediu>, o relatório
  está pronto.", a linha de `message_reports` e a Menção a quem pediu. `file_name` termina em
  `.pdf` e tem até 200 caracteres; `storage_key` começa com `reports/`.
- **`POST /v1/bot/requests/:id/report-failed`** sem corpo: grava, com a marca, "@<usuário de quem
  pediu>, não consegui gerar o relatório." e a Menção.
- O corpo da entrega e da falha é montado pela API do chat, e não pelo Worker, para a Menção ser
  sempre a quem pediu.
- **Credenciais:** `report-started` aceita só o `CHAT_BOT_TOKEN`; `report-delivered`, só o
  `CHAT_WORKER_TOKEN`; `report-failed`, os dois, porque o Serviço de agentes o grava quando
  enfileirar falha. Um guard novo confere o segredo do Worker com comparação de tempo constante,
  como o `BotTokenGuard`, e as outras rotas `/v1/bot` continuam recusando o segredo do Worker.
- **Menção e Notificação:** a Menção entra em `message_mentions` como a de uma Pessoa, e a
  Notificação de Menção sai do cálculo que já existe ([ADR 0027](../../adr/0027-notificacoes-calculadas.md)).
  O `publishBotMessage` passa a emitir o `activity.unread` para quem foi mencionado; as Mensagens de
  bot sem Menção continuam sem Notificação. O item de Atividade passa pelo `toMessageResponse` com
  o leitor, então quem perdeu a Permissão de dados vê o aviso de bloqueio.

### Referência ao PDF e download (API do chat)

- **Tabela `message_reports`**, `planejada`: `message_id` (chave primária e estrangeira para
  `messages`), `storage_key`, `file_name`, `size_bytes` e `created_at`. Uma tabela própria deixa
  `messages` como está e não decide nada pelos Anexos da F22.
- **Carga da Mensagem:** `toMessageResponse` ganha `report: { file_name, size_bytes } | null`; na
  versão bloqueada, `report` é nulo. `packages/chat-events` ganha o campo no `MessagePayload`. A
  `storage_key` nunca sai da API.
- **`GET /v1/messages/:id/report`**, com a Sessão: confere que a Pessoa é Membro da Conversa da
  Mensagem e que a Mensagem tem relatório (senão, 404 `message_not_found`); confere a Permissão de
  dados lida naquele momento (senão, 403 `data_access_required`); devolve `{ url }`, assinada pela
  `validade da URL do PDF`, com `ResponseContentDisposition` `attachment; filename="<file_name>"` e
  `ResponseContentType` `application/pdf`.
- **Variáveis novas:** `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY` e `CHAT_WORKER_TOKEN` no `env.schema.ts`.

### Cliente (web)

- **BFF `GET /api/messages/[id]/report`**, um route handler: chama a API do chat com a Sessão e
  responde 302 para a URL assinada; repassa 403 e 404 como uma página de erro curta. A URL assinada
  nunca vai para o HTML nem para o histórico do navegador antes do clique.
- **`ReportCard`**, componente novo em `components/agent/`: ícone de PDF, nome do arquivo, tamanho
  em KB ou MB e o link "Baixar", um `<a href>` para a rota do BFF, focável e acionado por Enter.
  Aparece abaixo do `AgentText` quando a Mensagem traz `report`. Na versão bloqueada, a Mensagem é a
  Resposta bloqueada da F13, sem cartão.
- O Aviso de início, a recusa de Relatório em andamento e o "não consegui" são Mensagens do Agente
  comuns (`AgentText`), sem componente novo. A Menção no corpo da entrega e da falha aparece como as
  outras Menções.
- `utils/message-event.ts` e o tipo da Mensagem ganham `report`.
- **Figma, antes do código:** o Figma é conferido e completado com os frames do PRD ("Todas as
  histórias"), no padrão `<Fluxo> / <Grupo> / <Estado>`, nos dois temas: o Aviso de início, a
  entrega com o `ReportCard`, a entrega bloqueada, a recusa de Relatório em andamento, o "não
  consegui gerar o relatório" e o layout do PDF.

### Auditoria (Serviço de agentes e Worker)

- **`business_queries`** ganha, numa migração do Alembic, a coluna `kind` (`answer` ou `report`,
  padrão `answer` para as linhas antigas) e o desfecho `delivered` no CHECK.
- O Serviço de agentes grava os desfechos antes da fila (`no_permission`, `not_found`,
  `ambiguous_name`, `too_generic`, e `error` quando enfileirar falha). O Worker grava uma linha só,
  no fim, com os dois SQLs compilados no campo `sql`, separados por uma linha em branco, e o
  desfecho `delivered`, `lastro_blocked` ou `error`. Uma tentativa que falha e volta à fila não grava
  linha. Nunca o resultado nem o PDF.

### Ambiente de desenvolvimento

- **Serviço `worker`** no `compose.yaml`: mesma imagem e mesmo volume do `agents`, que fica parado
  como os outros apps; o Worker roda com
  `docker compose -f compose.yaml exec worker uv run arq app.worker.WorkerSettings`, em segundo
  plano, como os outros processos. Depende de `postgres`, `redis` e `s3`.
- O `agents` e o `worker` recebem `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e
  `S3_SECRET_ACCESS_KEY` (os do serviço `s3`); o `worker` recebe `S3_CREATE_BUCKET=true` e o
  `CHAT_WORKER_TOKEN`, sem o `CHAT_BOT_TOKEN`. A `chat-api` recebe as mesmas, o `CHAT_WORKER_TOKEN`
  e `S3_PUBLIC_ENDPOINT=http://localhost:8333`.
- O `apps/agents/AGENTS.md` e o `AGENTS.md` raiz ganham o comando do Worker.
- Dependências novas no `agents`: `arq`, `fpdf2`, `boto3` e, nos testes, `pypdf`; no `chat-api`,
  `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`.

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que o Agente grava, o arquivo no S3, o texto do PDF, o que
aparece na tela), e não a forma interna. Os pontos de teste são os da F13, mais o Redis e o S3 dos
contêineres. A forma de cada teste da API do chat está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de ponta a ponta por HTTP com banco real:**

- `report-started` grava o aviso com a marca e estende a validade: uma `report-delivered` depois de
  2 min e antes do fim da validade nova é aceita;
- as credenciais: `report-delivered` com o `CHAT_BOT_TOKEN` e `reply` com o `CHAT_WORKER_TOKEN`
  recebem 401; `report-failed` aceita os dois;
- `report-delivered` sem `report-started` recebe `report_not_started`; depois de `report-failed`,
  `request_closed`; repetida, devolve a mesma Mensagem, sem segunda linha de `message_reports`;
- a entrega e a falha gravam a Menção a quem pediu, e a Atividade dela traz a Notificação, completa
  com permissão e bloqueada sem;
- o histórico traz `report` a quem tem Permissão de dados e `report` nulo na versão bloqueada;
- `GET /v1/messages/:id/report`: 200 com uma URL que baixa o PDF do S3 do contêiner; 403 sem
  Permissão de dados; 404 para quem não é Membro e para Mensagem sem relatório; tirar a permissão
  muda o próximo clique.

**API do chat, teste com `socket.io-client`:** a entrega chega com `report` a quem tem permissão e
bloqueada a quem não tem, em `message.created` e no reenvio da reconexão; quem pediu recebe o
`activity.unread`.

**Serviço de agentes e Worker, testes de unidade (`tests/unit`):** o período anterior (mês, trimestre,
ano, intervalo, em andamento, mês mais curto, virada de ano, bissexto), o nome do arquivo, a consulta
das seis Métricas compilada e aprovada pelo `readonly.py`, o lastro sobre o texto do PDF aceitando os
números certos e recusando um número adulterado, e o texto do Aviso de início.

**Serviço de agentes e Worker, testes de integração (`tests/integration`)**, com o Banco de negócio
de teste, o Redis de teste, o S3 do contêiner e a API do chat falsa da F11:

- o job completo contra o gabarito dos dados fixos: o texto extraído do PDF traz as seis Métricas
  nos dois períodos e as variações iguais aos números calculados à mão, com e sem filtro;
- base zero, período sem pedidos pagos e Métrica que não se aplica ao filtro;
- uma falha no S3 na primeira tentativa e sucesso na segunda entrega uma vez só, com a mesma chave;
- tentativas esgotadas gravam `report_failed`, auditam `error` e soltam a trava;
- a trava: um segundo `gerar_relatorio` com a trava presa grava a recusa; o Worker não solta a trava
  de outro Pedido;
- a ferramenta sem Permissão de dados grava a recusa e audita `no_permission` sem prender a trava;
- a ordem: o aviso é gravado antes de o job entrar na fila, e uma falha ao enfileirar grava
  `report_failed`;
- um Pedido real com o modelo real: "me manda um relatório de março de 2026 em PDF" grava o aviso, e
  o Worker entrega o PDF.

**Serviço de agentes, avaliação com o `adk eval`:** um evalset novo, `relatorio`, com configuração
própria e cerca de 15 casos, somados aos 73 da F13. A ferramenta `gerar_relatorio` roda até o aviso
contra o Banco de negócio com os dados fixos, sem Worker. Os casos:

- pedidos de Relatório com variações de escrita, com e sem filtro, com período explícito e em
  andamento;
- sem período (pergunta com as Respostas prontas), nome repetido e nome não encontrado;
- sem Permissão de dados;
- Relatório com lista, ranking, série, gráfico, contato e alteração (recusa curta);
- robustez: pergunta de número que não pede Relatório (vai para `consultar_dados`), instruções no
  Pedido para incluir contatos ou SQL, pedido de Relatório dentro de um resumo ou delegação.

As checagens exatas do PRD (seção 3) entram como argumentos esperados de `gerar_relatorio`, e o
texto das recusas e do aviso, como rubrica do juiz. O conteúdo do PDF, que o PRD põe na avaliação, é
conferido pelos testes de integração do Worker contra o gabarito, porque a avaliação do ADK roda só
o Agente. A meta continua ≥ 98% de todos os casos, e a avaliação fica fora da Verificação completa.

**Web, Vitest para as funções puras:** o tamanho do arquivo em KB ou MB e a escolha do cartão na
Mensagem.

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F14 junto dos testes. O Agente começa conectado, o bot criado, o Banco de
negócio carregado e o Worker rodando. Duas Pessoas em dois contextos do navegador, uma com
Permissão de dados e outra sem:

- com o modelo real, um teste só: a Pessoa com permissão pede o Relatório de março de 2026, vê o
  aviso, envia outra Mensagem, vê a entrega com o cartão, baixa o arquivo e confere que é um PDF; a
  outra vê o aviso e a entrega como Resposta bloqueada, sem recarregar;
- os outros estados com o bot agindo direto pelas rotas `/v1/bot/.../report-*`, sem o modelo: a
  entrega bloqueada depois de recarregar, o link do BFF com 403 para quem não tem permissão, a
  Notificação da entrega levando à Mensagem e o "não consegui";
- tudo pelo teclado, e a checagem de acessibilidade com `@axe-core/playwright` na Conversa com uma
  entrega completa e uma bloqueada, nos dois temas, sem violações.

**Medição:** o p95 ≤ 5 s do aviso e o p95 ≤ 60 s da entrega, da Mensagem enviada até a Mensagem do
Agente aparecer, com o modelo padrão, registrados em `medicao-p95.md` na pasta da tarefa que fecha
o caminho.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois temas,
comparada com o `get_screenshot` dos frames novos (`docs/design-system.md`, "Validação visual"), e o
PDF gerado comparado com o frame do layout, registrados na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse nos dois temas, na Conversa com uma entrega completa e uma bloqueada.

**Exemplos anteriores:** na API do chat, os testes das rotas do bot da F11 a F13 e da carga por
Pessoa da F13; no Serviço de agentes, os testes de integração da F13 com o Banco de negócio de
teste e a API falsa; na web, os testes da Mensagem do Agente e da Resposta bloqueada.

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- A retenção e a limpeza da auditoria (HLD, "Questões em aberto").
- O snapshot OpenAPI das rotas que mudam, que segue planejado no LLD.
- Painel ou métricas da fila; o andamento do Worker fica nos logs.

## Observações

- O glossário ganhou Pedido demorado, Aviso de início e Relatório (sessão de esclarecimento, Q1).
- Decididas na sessão de esclarecimento, sem ADR: arq como fila (Q2), fpdf2 com a Lato e pypdf (Q3),
  a ferramenta `gerar_relatorio` com o período anterior em código (Q4), a trava no Redis (Q5), a
  tabela `message_reports` (Q6), a chave no S3 pelo id do Pedido (Q7), as tentativas do Worker (Q8),
  o lastro sobre o texto do PDF (Q9), a coluna `kind` na auditoria (Q10), as ações de bot
  do Relatório (Q11), a validade estendida pelo Aviso de início (Q12), o aviso antes da fila (Q13), a
  Menção montada pela API do chat (Q14), o processo do Worker (Q15) com segredo próprio (Q21), as
  Métricas fora do filtro com "não se aplica" (Q22, que também ajustou o PRD), os clientes do S3
  (Q16), o download pelo BFF com 302 (Q17), o `ReportCard` (Q18), o PDF conferido nos testes do
  Worker (Q19) e a medição (Q20).
- O LLD muda em "Estrutura do código" (`app/worker/`), "Bibliotecas" (fila e PDF), "Segurança" (a
  credencial do Worker), "Integrações
  externas" (S3 e fila), "Concorrência e idempotência" (ações de bot do Relatório), "Dados"
  (`message_reports`), "Interfaces" (as rotas novas), "Processos de segundo plano" (o Worker),
  "Valores e configuração" e "Questões em aberto".
- O HLD não muda: a seção 6.5 já descreve o fluxo, e o aviso antes da fila só fixa a ordem dos dois
  passos que ela cita.
