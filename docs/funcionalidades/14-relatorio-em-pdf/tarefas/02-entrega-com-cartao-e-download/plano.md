# Plano da F14-T02: Entrega do Relatório com o cartão e o download

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado um Pedido da Ana com o Aviso de início, quando o Worker chama `report-delivered`
com `storage_key` `reports/<id do Pedido>.pdf`, `file_name` `relatorio-2026-03-01-a-2026-03-31.pdf`
e `size_bytes`, então responde 201 com a Mensagem do Agente com a marca, o corpo
"@<usuário da Ana>, o relatório está pronto.", a Menção à Ana e `report` com o nome e o tamanho; a
linha de `message_reports` existe com a chave; a repetição devolve a mesma Mensagem, sem segunda
linha; depois do `report-failed`, recebe `request_closed`; sem o aviso, `report_not_started`; com o
`CHAT_BOT_TOKEN`, 401; com `storage_key` fora de `reports/`, `file_name` sem `.pdf` ou com mais de
200 caracteres ou `size_bytes` não positivo, 400 `validation_failed`.

**Teste previsto:** e2e da API, `test/bot-report.e2e-spec.ts`, describe "report-delivered":
"report-delivered grava a entrega com a referência ao PDF e a Menção", "report-delivered repetido
devolve a mesma Mensagem", "report-delivered depois da falha responde 409 request_closed",
"report-delivered sem o aviso responde 409 report_not_started", "report-delivered recusa o segredo
de bot" e "report-delivered valida a chave, o nome e o tamanho".

### CA2

**Marca:** teste HTTP

**Cenário:** Dado uma entrega num Canal com a Ana (com Permissão de dados) e o Bruno (sem), quando
cada um lê o histórico, então a Ana recebe `report: { file_name, size_bytes }` e o Bruno `report:
null` com `blocked: true`; a Atividade da Ana traz a entrega com `report`; uma Mensagem sem relatório
traz `report: null`; nenhuma resposta traz `storage_key`; com `socket.io-client`, a Ana recebe o
`message.created` com `report` e o `activity.unread`, o Bruno recebe a versão bloqueada, e o reenvio
da reconexão do Bruno também vem bloqueado. O tipo do `MessagePayload` com `report` é conferido no
diff de `packages/chat-events`.

**Teste previsto:** e2e da API, `test/bot-report.e2e-spec.ts`, "o histórico traz report a quem tem
permissão e nulo na versão bloqueada" e "a Atividade traz a entrega com report";
`test/realtime-bot-report.e2e-spec.ts`, "a entrega chega com report a quem tem permissão e
bloqueada a quem não tem" e "a reconexão reenvia a entrega bloqueada".

### CA3

**Marca:** teste HTTP

**Cenário:** Dado uma entrega cujo PDF foi gravado no S3 do contêiner, quando a Ana pede
`GET /v1/messages/:id/report`, então recebe 200 `{ url }`, a URL baixa o mesmo PDF, com
`Content-Disposition` `attachment; filename="<file_name>"`, e o host da URL é o
`S3_PUBLIC_ENDPOINT`; o Bruno, Membro sem permissão, recebe 403 `data_access_required`; uma Pessoa
que não é Membro recebe 404 `message_not_found`, e uma Mensagem sem relatório, também; sem Sessão,
401; e, depois de tirar a permissão da Ana, o próximo pedido dela recebe 403.

**Teste previsto:** e2e da API, `test/message-report.e2e-spec.ts`, "devolve a URL assinada que
baixa o PDF", "responde 403 data_access_required sem Permissão de dados", "responde 404 a quem não
é Membro", "responde 404 a uma Mensagem sem relatório", "responde 401 sem Sessão" e "tirar a
permissão muda o próximo pedido".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dado uma entrega com o PDF no S3, quando a Ana abre `/api/messages/<id>/report`, então
o navegador segue o 302 e baixa o PDF; quando o Bruno abre o mesmo link, então vê a página curta
"Você não tem permissão para baixar este relatório." com status 403; e um id de Mensagem sem
relatório mostra "Relatório não encontrado." com 404. Provado junto com CA6.

**Teste previsto:** Playwright, `e2e/agentes/relatorio-entrega.spec.ts`, "Baixar baixa o PDF para
quem tem permissão" e "o link do relatório responde 403 para quem não tem permissão e 404 sem
relatório".

### CA5

**Marca:** revisão humana

**Cenário:** Quem revisa abre a seção "Relatório em PDF (F14)" do Figma e encontra os frames
`Conversa / Relatório / Entrega` e `Conversa / Relatório / Entrega bloqueada`, nos dois temas, com o
`ReportCard` (ícone de PDF, nome, tamanho e "Baixar") abaixo do texto do Agente, desenhados antes do
código; e o `ReportCard` no código é um link focável que Enter aciona (provado em CA6), com a
validação visual em 1440 × 900 nos dois temas registrada em `validacao-visual.md` na pasta desta
tarefa.

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado o bot do teste, a Ana com Permissão de dados e o Bruno sem, num Canal, e um PDF de
exemplo gravado no S3 na chave do Pedido, quando o bot grava o aviso e o Worker grava a entrega
pelas rotas, então a Ana vê o cartão com o nome do arquivo, o tamanho e "Baixar", sem recarregar, e
ao acionar "Baixar" pelo teclado recebe um download cujo arquivo começa com `%PDF`; depois de
recarregar, o cartão continua lá; o Bruno vê a Resposta bloqueada, sem cartão. Os testes HTTP de
CA1 a CA3 e o Vitest do tamanho e da escolha do cartão completam o critério.

**Teste previsto:** Playwright, `e2e/agentes/relatorio-entrega.spec.ts`, "a entrega mostra o cartão
a quem tem permissão e a Resposta bloqueada à outra Pessoa" e "Baixar baixa o PDF para quem tem
permissão"; Vitest, `src/app/utils/report-card.test.ts`, "formata o tamanho em KB e em MB" e "só a
Mensagem com relatório e sem bloqueio mostra o cartão".

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre o `docs/lld.md` e encontra `report-delivered`, a credencial do
Worker na entrega, `message_reports`, `GET /v1/messages/:id/report` e a rota do BFF como `existe`, e
as variáveis de S3 da API do chat no ambiente de desenvolvimento.

## Contrato

### message_reports · chat · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `message_id` | uuid | não | — | Chave primária e estrangeira para `messages(id)`, `ON DELETE CASCADE` |
| `storage_key` | text | não | — | A chave no S3; `CHECK (storage_key LIKE 'reports/%')`, escrito à mão na migração |
| `file_name` | text | não | — | `CHECK (char_length(file_name) BETWEEN 5 AND 200 AND file_name LIKE '%.pdf')`, à mão na migração |
| `size_bytes` | integer | não | — | `CHECK (size_bytes > 0)`, à mão na migração |
| `created_at` | timestamptz | não | `now()` | |

### POST /v1/bot/requests/:id/report-delivered · nova

| Item | Descrição |
| --- | --- |
| Autenticação | `Authorization: Bearer <CHAT_WORKER_TOKEN>`; o `CHAT_BOT_TOKEN` é recusado |
| Parâmetros de caminho | `id`: id do Pedido |
| Corpo da requisição | `{ storage_key: string, file_name: string, size_bytes: integer }`, todos obrigatórios; `storage_key` começa com `reports/` e tem até 200 caracteres; `file_name` termina em `.pdf` e tem de 5 a 200 caracteres; `size_bytes` inteiro positivo |
| Resposta de sucesso | 201 `{ message: MessageResponse }`, com `business_data: true`, o corpo "@<usuário de quem pediu>, o relatório está pronto.", `mentions` com quem pediu e `report` com o nome e o tamanho; a repetição devolve a mesma Mensagem |
| Erros | 400 `validation_failed`; 401 `invalid_bot_token`; 404 `request_not_found`; 409 `report_not_started`; 409 `request_closed`; 410 `request_expired` |

### GET /v1/messages/:id/report · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Sessão (cookie), como as outras rotas da Pessoa |
| Parâmetros de caminho | `id`: id da Mensagem (uuid; malformado é `message_not_found`) |
| Resposta de sucesso | 200 `{ url: string }`, assinada com o `S3_PUBLIC_ENDPOINT` pela validade da URL do PDF, com `ResponseContentDisposition` `attachment; filename="<file_name>"` e `ResponseContentType` `application/pdf` |
| Erros | 401 `unauthenticated`; 403 `data_access_required`; 404 `message_not_found` (não é Membro, Mensagem apagada ou sem relatório) |

### Erro `data_access_required` · novo

Código estável novo no `ErrorCode`, com status 403 e o detalhe "Você não tem permissão para ver
dados de negócio.".

### GET /api/messages/[id]/report (BFF) · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Cookie de sessão da web; sem ele, 302 para `/login` |
| Chama | `GET /v1/messages/:id/report` com o token da Sessão |
| Resposta de sucesso | 302 com `Location` na URL assinada, `Cache-Control: no-store` |
| Erros | 403: página HTML curta "Você não tem permissão para baixar este relatório."; 404: "Relatório não encontrado."; outra falha: 502 "Não foi possível baixar o relatório agora." |

### MessageResponse e MessagePayload · alterados

Ganham `report: { file_name: string; size_bytes: number } | null`, nulo quando a Mensagem não tem
relatório ou sai bloqueada. No `MessagePayload` de `chat-events`, opcional (`report?:`), porque o
evento guardado antes da F14 não o traz.

### Variáveis de ambiente da API do chat · novas

`S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT` (URLs), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
(strings não vazias), no `env.schema.ts`, no `.env.example` e no `compose.yaml` (`chat-api`, com
`S3_PUBLIC_ENDPOINT=http://localhost:8333`). Nos testes da API, `S3_PUBLIC_ENDPOINT` é o
`http://s3:8333`, porque o teste baixa a URL de dentro do contêiner.

## Verificação do contrato

- `message_reports` e os CHECK: CA1 (linha gravada; a validação do DTO barra antes do banco).
- `report-delivered` 201, repetição, `request_closed`, `report_not_started`, 401, 400: CA1.
- `report` no histórico, no evento, na reconexão e na Atividade, e a ausência da chave: CA2.
- `GET /v1/messages/:id/report` 200, 403, 404 (dois casos), 401: CA3.
- BFF 302, 403 e 404: CA4.
- O 502 do BFF para outra falha não ganha teste: depende de derrubar a API no meio do teste, e o
  código é o mesmo `switch` dos outros dois casos.

## Decisões

- `report-delivered` fica no `BotReportsController`, com `bearerTokenGuard('CHAT_WORKER_TOKEN')`
  (o `WorkerTokenGuard`), e grava pelo mesmo `once` com a admissão do Relatório da tarefa 01.
- A linha de `message_reports` e a Mensagem entram na mesma transação do `once`; o
  `MessagesService` ganha `insertBotMessage(..., { report })`, que grava a linha junto, e a
  `MessageView` ganha `report: { fileName, sizeBytes } | null`. A chave fica só na tabela e no
  service do download.
- A leitura do `report` nas listas sai numa consulta por lote pelos ids (como as Menções), junto das
  outras de `viewsByIds`, sem `JOIN` novo na consulta do histórico.
- O download fica num módulo novo, `reports`, com `MessageReportsController`
  (`GET /v1/messages/:id/report`), `MessageReportsService.downloadUrl(personId, messageId)` e o
  armazenamento atrás de `OBJECT_STORAGE = Symbol('OBJECT_STORAGE')`, cuja implementação
  `S3ObjectStorage` usa o `@aws-sdk/client-s3` e o `@aws-sdk/s3-request-presigner`, com
  `forcePathStyle`. A configuração é `storageConfig`, com `registerAs`, a partir das variáveis
  validadas.
- A participação é conferida pela regra de "Segurança" do LLD (a Pessoa é Membro da Conversa da
  Mensagem), e a Permissão de dados é lida no `PeopleService` na hora do pedido, nunca da Sessão.
- O 404 vale para quem não é Membro, para a Mensagem apagada e para a sem relatório, nessa ordem de
  leitura, e vem antes do 403: quem não é Membro não descobre que a Mensagem tem relatório.
- A validade da URL do PDF é a constante `REPORT_URL_TTL_SECONDS = 300` no módulo `reports`.
- Os testes da API gravam o PDF de exemplo no S3 do contêiner com o mesmo cliente, criando o bucket
  se ele não existir; o bucket dos testes é o `reports`, o mesmo do desenvolvimento, com chaves
  únicas por Pedido.
- No Playwright, o PDF de exemplo é gravado no S3 por um apoio novo, `e2e/support/s3.ts`, com o
  `@aws-sdk/client-s3` como dependência de desenvolvimento da web; o contêiner `e2e` recebe as
  variáveis de S3 e o `port-forward.mjs` passa a encaminhar `localhost:8333` ao `s3:8333`, para o
  navegador do teste seguir a URL assinada com o mesmo endereço do navegador da máquina.
- A web: `Message` ganha `report: { fileName, sizeBytes } | null`; `utils/report-card.ts` tem
  `formatReportSize(bytes)` (KB com uma casa abaixo de 1 MB, MB com uma casa acima, vírgula
  decimal) e `reportOf(message)` (o relatório só quando a Mensagem é de bot, não bloqueada e traz
  `report`); `components/agent/report-card.tsx` é o `ReportCard`, um Server Component sem estado,
  com o link `<a href="/api/messages/<id>/report" download>` e o nome acessível
  "Baixar <nome do arquivo>".
- Os frames de entrega e entrega bloqueada no Figma, nos dois temas, entram antes do código da
  tela.

## Arquivos e interfaces

- `apps/chat-api/migrations/1794530000000-AddMessageReports.ts`: tabela e CHECK.
- `apps/chat-api/src/messages/message-report.entity.ts`: `MessageReport`.
- `apps/chat-api/src/messages/messages.service.ts`: `insertBotMessage(..., { report })`,
  `MessageView.report`, leitura em lote, `findReport(messageId)`.
- `apps/chat-api/src/messages/message.response.ts`: `report` no `MessageResponse`.
- `packages/chat-events/index.d.ts`: `ReportPayload` e `report?` no `MessagePayload`.
- `apps/chat-api/src/bot/bot-reports.controller.ts`, `report-delivered.dto.ts`,
  `bot-actions.service.ts` (`reportDelivered`), `bot-token.guard.ts` (`WorkerTokenGuard`).
- `apps/chat-api/src/reports/`: `reports.module.ts`, `message-reports.controller.ts`,
  `message-reports.service.ts`, `object-storage.ts` (`OBJECT_STORAGE`, `ObjectStorage`),
  `s3-object-storage.ts`, `storage.config.ts` (`storageConfig`), `report-values.ts`,
  `data-access-required.error.ts`.
- `apps/chat-api/src/common/errors/error-code.ts` e `problem-details.filter.ts`:
  `data_access_required`.
- `apps/chat-api/src/config/env.schema.ts`, `.env.example`, `compose.yaml`: variáveis de S3.
- `apps/chat-api/test/support/test-env.ts`, `test/support/report-storage.ts` (`putSamplePdf`).
- `apps/chat-api/test/message-report.e2e-spec.ts`: novo.
- `apps/web/src/app/api/messages/[id]/report/route.ts`: BFF.
- `apps/web/src/app/services/chat-api.ts`: `getMessageReportUrl(token, id)`, `Message.report`.
- `apps/web/src/app/utils/message-event.ts`: `report` do payload.
- `apps/web/src/app/utils/report-card.ts` e `.test.ts`; `components/agent/report-card.tsx`;
  `components/message/message-item.tsx`.
- `apps/web/e2e/support/s3.ts`, `e2e/support/bot.ts` (`workerReportDelivered`),
  `e2e/support/port-forward.mjs`, `e2e/agentes/relatorio-entrega.spec.ts`,
  `e2e/plano-de-testes-f14.md`.

## Testes existentes que mudam

- Os testes que comparam a Mensagem inteira com `toEqual` passam a ver `report: null`; os que usam
  `toMatchObject` não mudam.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra `message_reports`, as rotas, a credencial e o endereço
do S3 como `planejados`, pela spec. A passagem a `existe` entra no fim da tarefa (CA7).
