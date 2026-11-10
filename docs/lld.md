# LLD — Full Cycle Chat

2026-11-10 · Luiz Carlos · Status: rascunho · HLD: [hld.md](hld.md)

**Onde mora cada fato**

| Fato | Dono |
| --- | --- |
| Arquitetura, contêineres, integrações e motivos | [HLD](hld.md) |
| Decisões com porquê | `docs/adr/`, com o índice na seção "Decisões" deste documento e do HLD |
| Escopo e público | [Product brief](product-brief.md) |
| Vocabulário | `GLOSSARY.md` na raiz |
| Linguagem visual (cores, componentes, microtexto) | [Figma](https://www.figma.com/design/plW17JDOoRHydUJIIi2u87/slack) |
| Contrato REST da API do chat | `apps/chat-api/openapi.json`, gerado pelo `@nestjs/swagger` (planejado) |
| Contrato REST do Serviço de agentes | `apps/agents/openapi.json`, gerado pelo FastAPI (planejado) |
| Catálogo de códigos de erro | Os snapshots OpenAPI, como enum na resposta de erro de cada rota (planejado) |
| Eventos do WebSocket | Tipos TypeScript em `packages/chat-events/` |
| Schema do Banco do chat | `apps/chat-api/migrations/`, migrações do TypeORM |
| Schema do Banco dos agentes | A definir |
| Schema do Banco de negócio | Script de carga em `apps/agents/scripts/` (planejado) |
| Schema das variáveis de ambiente | O schema zod do módulo de configuração de cada projeto TypeScript (`apps/chat-api/src/config/env.schema.ts` e `apps/web/src/app/config/env.ts` existem); do projeto `agents`, a definir |
| Práticas e comandos | `apps/*/AGENTS.md`, um por app, apontados pelo `AGENTS.md` da raiz (planejado) |

Os snapshots OpenAPI ficam gravados no repositório, e a CI falha quando o código muda o contrato
sem atualizar o snapshot.

## 1. Estrutura do código

Um repositório com três aplicações implantadas separadamente (HLD, seção 5) e um pacote de tipos
compartilhado. `web`, `chat-api` e `chat-events` são projetos pnpm independentes, cada um com o
seu lockfile, sem workspace ([ADR 0017](adr/0017-projetos-pnpm-independentes.md)); `chat-events`
entra em `web` e em `chat-api` como dependência `file:../../packages/chat-events`, e uma mudança
nele exige reinstalar nos dois projetos. O projeto `agents` é gerenciado pelo uv.

```
apps/
  web/            Frontend/BFF (Next.js)                              existe
  chat-api/       API do chat (NestJS): REST, WebSocket e o comando   existe
                  de contas e permissões (HLD, seção 2)
    migrations/   migrações do Banco do chat                          existe
  agents/         Serviço de agentes e Worker (Python + ADK),         planejada
                  dois processos do mesmo projeto
    scripts/      script de carga do Banco de negócio                 planejada
packages/
  chat-events/    tipos dos eventos do WebSocket, usados por          existe
                  chat-api e web
docs/             HLD, LLD, ADRs, brief
```

| Papel | Escolha | Por quê |
| --- | --- | --- |
| Frontend/BFF | Next.js com App Router | Next.js: HLD, seção 5 ([ADR 0002](adr/0002-next-bff-websocket-direto.md)); App Router: a definir |
| Mutações do navegador ao BFF | Server Actions | Checagem de `Origin` do próprio Next contra CSRF, formulário que funciona por teclado e nenhuma rota REST a manter para o navegador |
| Leituras no cliente que o tempo real altera | SWR | O cache recebe os eventos do WebSocket direto, sem nova requisição, e a primeira página vem do servidor como `fallbackData` ("Cliente", "Leituras e tempo real") |
| Tempo real, no servidor e no cliente | Socket.IO | [ADR 0019](adr/0019-socket-io-tempo-real.md) |
| Cliente do Redis na API do chat | `redis` (node-redis) | Cliente oficial do Redis |
| API do chat | NestJS | HLD, seção 5 |
| ORM e migrações do Banco do chat | TypeORM | [ADR 0018](adr/0018-typeorm-api-do-chat.md) |
| Transação entre módulos na API do chat | `@nestjs-cls/transactional`, com o adaptador do TypeORM | A transação passa de um service a outro pelo contexto, sem levar o `EntityManager` à mão nem importar o repositório de outro módulo |
| Snapshot do contrato da API do chat | `@nestjs/swagger` | Gera o OpenAPI a partir do código |
| Hash de senha | Argon2id | Primeira recomendação da OWASP para senhas |
| Testes de ponta a ponta do `web` | Playwright, só no Chromium em modo headless, com `@axe-core/playwright` | Prova os fluxos pela tela, com a web e a API reais, e é o seam dos fluxos da web; o produto é só para navegador de desktop |
| Testes de unidade do `web` | Vitest, em ambiente Node, só para funções puras com muitos casos | Provar dezenas de casos de data e de texto (agrupamento, divisor de dia, links, contagem de caracteres) pelo navegador seria lento; o Playwright continua provando os fluxos |
| Gerenciador dos projetos TypeScript | pnpm, um projeto por pasta, sem workspace | [ADR 0017](adr/0017-projetos-pnpm-independentes.md) |
| Agentes | Python + Google ADK | [ADR 0003](adr/0003-agentes-python-google-adk.md) |
| HTTP do Serviço de agentes | FastAPI próprio, com as rotas chamando o `Runner` do ADK | A definir |
| Gerenciador do projeto Python | uv | A definir |
| Fila de pedidos demorados | A definir | — |
| Acesso ao modelo, trocável por configuração (HLD, seção 2) | A definir | — |
| Geração do PDF | A definir | — |
| Acesso ao Banco dos agentes e migrações | A definir | — |
| Validação das variáveis de ambiente | zod, com `@nestjs/config` na API do chat; no projeto `agents`, a definir | Valida e tipa numa peça só, igual nos dois projetos TypeScript |
| Validação de entrada na API do chat | `class-validator` e `class-transformer`, no `ValidationPipe` do Nest | Caminho padrão do Nest, e o `@nestjs/swagger` lê os mesmos decorators para gerar o snapshot OpenAPI; descartado: zod com `nestjs-zod` |
| Parser da conferência de somente leitura | A definir | — |
| Log estruturado | A definir | — |

## 2. Componentes e dependências

Os tipos de peça de cada aplicação, o que cada tipo pode chamar e o diagrama das dependências
permitidas estão a definir, assim como os módulos de domínio da API do chat, do projeto `agents`
e do projeto `web`. O que já vale vem do HLD: o BFF dispara o agente
([ADR 0009](adr/0009-bff-dispara-agente.md)), o agente grava pela API do chat como bot
([ADR 0010](adr/0010-agente-grava-como-bot.md)) e o Worker nunca chama o modelo (HLD, seção 5).

### Integrações externas

Situação: "Eventos por pessoa (Redis)" `existe`; as demais, `planejada`.

**Armazenamento de objetos (S3)** — usado pelo Worker (gravar) e pela API do chat (URL).

| Operação | Recebe | Devolve | Garante |
| --- | --- | --- | --- |
| Gravar PDF | Chave e arquivo | Nada | Regravar a mesma chave substitui o arquivo; uma nova tentativa do Worker não duplica |
| Gerar URL de download | Chave e validade | URL assinada | Vencida a validade (`validade da URL do PDF`), a URL recusa |

**Fila de pedidos demorados** — o Serviço de agentes enfileira e o Worker consome.

| Operação | Recebe | Devolve | Garante |
| --- | --- | --- | --- |
| Enfileirar | Identificador de pedido e consulta já conferida | Nada | Enfileirar duas vezes o mesmo identificador gera um job só |
| Consumir | — | Um job ao Worker | Se o Worker falha, o job volta à fila até `tentativas do Worker` |

**Eventos por pessoa (Redis)** — usado pela API do chat para a reconexão (HLD 6.2).

| Operação | Recebe | Devolve | Garante |
| --- | --- | --- | --- |
| Guardar evento | Pessoa e evento | Identificador crescente por pessoa | A ordem dos identificadores é a ordem dos eventos daquela pessoa; cada gravação corta os eventos mais velhos que a `retenção dos eventos de reconexão` |
| Ler desde | Pessoa e último identificador confirmado | Os eventos seguintes, ou "perdido" | "Perdido" quando o corte pode ter apagado algum evento posterior ao identificador (há eventos mais novos e o primeiro que sobrou é posterior a ele), ou quando o Redis perdeu os dados desde que o identificador foi entregue; o cliente então recarrega pelo histórico |

Um stream por Pessoa, com a época que denuncia a perda dos dados. O mecanismo e a ordem da conexão estão na [spec da F03](funcionalidades/03-tempo-real/spec.md), seção "Eventos por Pessoa e reconexão".

**Contadores (Redis)** — usados pelo Serviço de agentes (HLD 6.3).

| Operação | Recebe | Devolve | Garante |
| --- | --- | --- | --- |
| Conferir e contar pedido | Pessoa | Permitido ou negado | Nega acima do `limite de pedidos por pessoa` |
| Somar custo | Pedido e custo | Se o teto foi atingido | Compara com o `teto de custo por pedido` |

Com o Redis fora, as operações de contadores falham e o pedido é recusado (HLD, seção 8, "Erros,
novas tentativas e idempotência").

## 3. Conceitos transversais de implementação

### Segurança

- **Cookie de sessão:** gravado e apagado pelo BFF, com `HttpOnly`, `Secure`, `SameSite=Lax`,
  `Path=/` e `Max-Age` igual à `validade do cookie de sessão`. O `Domain` vem de variável e vale
  para os subdomínios (HLD 6.1). O cookie dura mais que a Sessão de propósito: quem decide se a
  Sessão vale é a API do chat ("Estados e regras", seção "Sessão e login"), e um cookie com Sessão
  vencida só leva a um 401. `Lax` não atrapalha o WebSocket, porque `app.` e `api.` são o mesmo
  site.
- **CSRF:** sem token anti-CSRF. As mutações do navegador são Server Actions, que conferem o
  cabeçalho `Origin`; o handshake do WebSocket confere a origem contra `WEB_ORIGIN`, no
  `allowRequest` do Socket.IO, porque o transporte `websocket` não passa por CORS.
- **Identificador de sessão:** token aleatório de 32 bytes, entregue ao BFF uma vez, ao entrar.
  O Banco do chat guarda só o SHA-256 dele, então um vazamento do banco não dá Sessões válidas. O
  token nunca vai para o log.
- **Senha:** guardada como hash Argon2id. Quando o e-mail não tem conta, o login verifica a senha
  contra um hash fictício, para o tempo de resposta não revelar se a conta existe.
- **Limite de tentativas de login:** contado só pelo e-mail normalizado, inclusive de e-mails sem
  conta, e guardado no Banco do chat ([ADR 0023](adr/0023-limite-de-login-por-email.md)). As
  regras estão em "Estados e regras", seção "Sessão e login".
- **Participação numa Conversa:** conferida no service de Conversas, por uma operação única,
  "Conversa da qual a Pessoa é Membro", que toda rota e todo service que recebe um id de Conversa
  usa, e que a F03 reaproveita no WebSocket. Conversa inexistente, sem participação ou com id
  malformado recebem o mesmo `conversation_not_found`, para a resposta não revelar se a Conversa
  existe.
- **Credenciais de bot e de serviço:** a forma (um segredo por processo ou por agente) está a
  definir. Toda ação de bot leva o identificador de pedido
  ([ADR 0011](adr/0011-identificador-de-pedido.md)).
- **Dados de negócio no tempo real:** uma mensagem marcada "dados de negócio" é emitida pelo
  WebSocket pessoa a pessoa. Quem tem permissão de dados recebe o evento com o conteúdo; os outros
  membros recebem o evento com a versão bloqueada. O evento guardado nos eventos de reconexão
  segue a mesma regra, por pessoa. Mensagens sem a marca saem num evento só para a conversa
  ([ADR 0020](adr/0020-dados-de-negocio-pessoa-a-pessoa.md); depende de mudança no HLD). Uma
  função única monta a mensagem para o histórico, o REST e os eventos, `planejada` na
  [spec da F06](funcionalidades/06-acoes-na-mensagem/spec.md), seção "Mensagens". Ela também monta a versão de cada
  destinatário de Atividade, `planejada` ([spec da F08](funcionalidades/08-notificacoes-e-atividade/spec.md), seção "Notificações e contagem"); a versão de
  dados de negócio de cada destinatário segue a detalhar.

### Concorrência e idempotência

- **Envio de mensagem:** unicidade em (autor, identificador gerado no cliente). A inserção tolera
  o conflito: se o identificador já existe, a API devolve a mensagem já gravada, com o mesmo
  status de sucesso, e não gera de novo menções, notificações nem eventos, nem avança a Última
  leitura.
- **Participação em Canal público:** criar um Canal público inclui todas as Pessoas, e criar uma
  conta inclui a Pessoa em todos os Canais públicos. As duas transações começam tomando a mesma
  trava transacional do Postgres (`pg_advisory_xact_lock`, chave fixa), para uma conta e um Canal
  criados ao mesmo tempo não deixarem a Pessoa fora do Canal; a gravação tolera a participação que
  já existe ([ADR 0024](adr/0024-conversas-numa-tabela-so.md)).
- **Criação de Canal pelo produto:** unicidade em (criador, identificador gerado no cliente). A
  criação toma a mesma trava da participação em Canal público, nos dois tipos de Canal, e confere
  primeiro o identificador: se ele já existe, a API devolve o Canal já criado, com o mesmo status
  de sucesso, e não publica evento. Só depois confere o nome, único entre todos os Canais.
- **Adicionar ao Canal privado:** a gravação tolera a participação que já existe, e só as Pessoas
  adicionadas agora geram evento.
- **Abrir Conversa direta:** unicidade no par de Pessoas, na própria Conversa. A gravação da
  Conversa e a da participação de quem abriu toleram o que já existe, e abrir pelas duas pontas ao
  mesmo tempo dá na mesma Conversa. Só quem passou a ser Membro agora gera evento
  ([ADR 0025](adr/0025-membro-da-conversa-direta-na-primeira-mensagem.md)), existe
  ([spec da F05](funcionalidades/05-busca-de-pessoas-perfil-e-conversa-direta/spec.md), seção "Conversa direta").
- **Primeira Mensagem da Conversa direta:** na transação do envio, grava a participação da outra
  Pessoa do par, tolerando a que já existe. Se a gravou agora, o evento de entrada sai antes do
  `message.created`, para a mesma Pessoa, e uma Mensagem enviada logo depois espera essa
  publicação; o reenvio idempotente não grava nem publica nada (ADR 0025), existe (spec da F05,
  seção "Conversa direta").
- **Editar e apagar mensagem:** só o autor. Na edição vale a última gravação; o mesmo texto não
  muda nada nem publica evento, e `edited_at` é estritamente crescente por mensagem. A edição e a
  exclusão conferem a participação de novo com a Conversa travada em modo compartilhado (em série
  com a remoção de Membro) e leem a mensagem com trava de linha, para uma não gravar sobre a outra;
  a que chega depois da exclusão responde como Mensagem inexistente, e o cliente trata isso como já
  apagada. A edição recalcula as menções e grava só a diferença; apagar mantém as menções, para a
  F07 e a F08. Os eventos saem depois do commit, numa fila por mensagem na API (a criação, as
  edições e a exclusão na ordem das gravações), e o cliente ainda descarta a edição obsoleta ou que
  chega depois da exclusão. A
  edição, a exclusão e as menções existem (spec da F06, seções "Mensagens", "Tempo
  real" e "Cliente").
- **Ação de bot:** unicidade em (identificador de pedido, tipo de ação). Tipos: resposta, pergunta
  ao usuário, aviso de início, entrega do PDF, criação de tarefa. A repetição devolve o que já foi
  gravado, sem nova mensagem, tarefa ou notificação.
- **Não lidas e menções:** calculadas a partir da Última leitura, e não gravadas: as Mensagens da
  Conversa posteriores a ela, de outro autor e não apagadas, e as menções à Pessoa entre elas, com
  a contagem parando no "Teto da contagem de não lidas" ("Valores e configuração"). A exclusão e a
  edição que muda menção não gravam nada a mais
  ([ADR 0026](adr/0026-nao-lidas-calculadas-da-ultima-leitura.md)). As não lidas saem do índice de
  Mensagens por Conversa e id, e as menções, do índice de menções por Pessoa e Mensagem, existe
  ([spec da F07](funcionalidades/07-nao-lidas-e-mencoes/spec.md), seção "Última leitura e
  contagem").
- **Última leitura:** o id da última Mensagem lida, na participação; só avança. A atualização é
  condicional: grava só se a gravada for nula ou anterior à nova; uma posição igual ou anterior,
  vinda de uma aba atrasada, não muda nada nem publica evento. Enviar uma Mensagem avança a do
  autor na mesma transação, e a posição inicial de quem vira Membro é a última Mensagem que já
  existia, menos a da outra Pessoa da Conversa direta, que começa nula. Os números saem para as
  abas calculados na hora de publicar, numa fila por Conversa na API, separada da fila por
  Mensagem, que não espera por ela; tudo isso existe (spec da F07,
  seções "Última leitura e contagem" e "Tempo real").
- **Notificações:** calculadas, e não gravadas: as Menções à Pessoa em Canais de que ela é Membro e
  as Mensagens de outro autor nas Conversas diretas dela, não apagadas; lida quando a Mensagem é
  igual ou anterior à Última leitura da Conversa ou à marca de Atividade da Pessoa, que só avança,
  como a Última leitura. A exclusão, a edição que muda Menção e a leitura da Conversa não gravam
  nada a mais ([ADR 0027](adr/0027-notificacoes-calculadas.md)). Os números de Atividade, com o
  "Teto da contagem de não lidas", saem para as abas calculados na hora de publicar, numa fila
  por Pessoa na API, que existe ([spec da F08](funcionalidades/08-notificacoes-e-atividade/spec.md), seções "Notificações e contagem" e "Tempo real").

### Transações

O que precisa ser atômico é do HLD (seção 7, "Regras que pesam no desenho"): a mensagem com as
menções, as notificações e os contadores; a tarefa com a notificação dela. O evento só sai depois
do commit. Na API do chat, a transação começa no método do service que orquestra, marcado com
`@Transactional()`, e passa aos services de outros módulos pelo contexto do CLS: quem participa
acessa o banco pelo `TransactionHost`, e não pelo repositório injetado. O evento é publicado
direto, depois que a transação termina, pelo service que orquestra, e só quando a gravação foi
nova: um reenvio idempotente não publica. A queda do processo entre o commit e a publicação perde o
evento, e quem estava conectado só o vê ao abrir a conversa de novo; sem tabela de saída, porque a
API do chat roda com uma instância só (HLD 6.2).

### Erros

- Corpo de erro nas três APIs (BFF, API do chat, Serviço de agentes): `application/problem+json`
  (RFC 9457), com a extensão `code`, estável e em `snake_case`. O corpo tem `type`
  (`about:blank`), `title` (a frase do status HTTP), `status`, `detail` e `code`, sem `instance`.
  O `detail` é para pessoas e não traz detalhes internos.
- O catálogo de códigos fica nos snapshots OpenAPI, como enum na resposta de erro de cada rota.
- Na API do chat, o service e o guard lançam erro de domínio, e só o filter global o traduz em
  resposta HTTP: `.claude/rules/nest-api-errors.md`. No BFF e no Serviço de agentes, quem traduz
  está a definir.
- **Mensagem gravada, mas o Serviço de agentes não recebeu o pedido** (HLD 6.3): o BFF responde
  sucesso, com a mensagem gravada e um campo que diz que o agente não recebeu o pedido. A tela
  mostra a mensagem enviada e um aviso de erro do agente ao lado.

### Logs

A regra do HLD vale para todos os projetos: logs estruturados, sem conteúdo de mensagens e sem
resultado de consultas (HLD, seção 8, "Observabilidade"). A biblioteca, os campos de correlação e
a lista completa do que nunca vai para o log estão a definir.

| Nível | Quando |
| --- | --- |
| info | Fim de cada requisição e de cada pedido a agente, com tempo de resposta e custo como campos |
| warn | Resposta barrada pelo lastro; limite de pedidos ou teto de custo atingido; tentativa de login bloqueada |
| error | Falha do modelo; tentativas do Worker esgotadas; exceção inesperada |

### Configuração

- Cada projeto tem um módulo de configuração só, que lê e valida as variáveis uma vez na subida.
  Nenhum outro arquivo lê `process.env` ou `os.environ`; as peças recebem a configuração já
  tipada.
- Faltou uma variável obrigatória: o processo falha na subida, com o nome da variável na
  mensagem, e nunca no primeiro uso. Assim, a conferência de saúde da PaaS barra a versão nova e
  mantém a anterior (HLD, seção 9).
- Cada projeto tem um `.env.example` gravado no repositório, com todas as variáveis e valores
  falsos; o `.env` real fica no `.gitignore`.
- A biblioteca de validação está na seção "Estrutura do código"; a lista das variáveis fica em
  "Valores e configuração".

## 4. Dados

**Convenções** (tabelas nossas do Banco do chat e do Banco dos agentes; as tabelas de sessão do
ADK seguem o ADK):

- Nomes em `snake_case`, tabelas no plural (`messages`, `channel_members`); o TypeORM usa uma
  estratégia de nomes que converte os nomes do código.
- Id em UUID v7, gerado na aplicação ([ADR 0022](adr/0022-uuid-v7.md)).
- Datas em `timestamptz`, sempre em UTC, com `created_at` e `updated_at` em toda tabela. A
  conversão para o fuso de quem pediu acontece só na borda: na tela e no recorte "hoje" do agente.
- Exclusão física. A exceção é a mensagem: apagar zera o conteúdo e grava `deleted_at`, e a linha
  fica só para as citações a ela mostrarem "mensagem apagada" (HLD, seção 7); o histórico não a
  traz.

O diagrama de entidades e relações está a definir. As unicidades e os contadores que as regras já
exigem estão em "Conceitos transversais de implementação", seção "Concorrência e idempotência".

| Banco | Entidade (HLD, seção 7) | Situação |
| --- | --- | --- |
| Chat | Pessoas (perfil, papel de administrador, permissão de dados) | existe a base da F01 (`people`), com @usuário, cargo, telefone e fuso ([spec da F05](funcionalidades/05-busca-de-pessoas-perfil-e-conversa-direta/spec.md), seção "Pessoas"); papel e permissão a detalhar |
| Chat | Sessões | existe (`sessions`) |
| Chat | Tentativas de login por e-mail | existe (`login_attempts`) |
| Chat | Conversas e participações, numa tabela só para Canais e Conversas diretas ([ADR 0024](adr/0024-conversas-numa-tabela-so.md)) | existe: Canal público e privado, criador e identificador da criação (`conversations`, `conversation_members`) ([spec da F04](funcionalidades/04-criacao-de-canais-e-convite-para-canal-privado/spec.md), seção "Conversas") |
| Chat | Conversas diretas | existe: tipo de Conversa (ADR 0024), com o par de Pessoas único (`conversations`) e a outra Pessoa Membro na primeira Mensagem (ADR 0025) (spec da F05, seção "Conversa direta") |
| Chat | Mensagens (autor pessoa ou bot, citação, marca "dados de negócio") | existe: autor pessoa, texto, edição, exclusão e citação (`messages`, `edited_at`, `deleted_at`, `quoted_message_id`) ([spec da F06](funcionalidades/06-acoes-na-mensagem/spec.md), seção "Mensagens"); autor bot e marca a detalhar |
| Chat | Menções | existe: resolvidas na gravação a partir do @usuário, só para Membros (`message_mentions`) (spec da F06, seção "Mensagens") |
| Chat | Última leitura por pessoa e conversa, de onde saem as não lidas e as menções (ADR 0026) | existe: `last_read_message_id` em `conversation_members` (spec da F07, seção "Última leitura e contagem") |
| Chat | Notificações, calculadas sem tabela (ADR 0027) | existe: só a marca de Atividade, `activity_read_message_id` em `people` ([spec da F08](funcionalidades/08-notificacoes-e-atividade/spec.md), seção "Notificações e contagem") |
| Chat | Tarefas | a detalhar |
| Chat | Pedidos aos agentes e ações de bot | a detalhar |
| Chat | Perguntas pendentes | a detalhar |
| Chat | Referência ao PDF de uma mensagem | a detalhar |
| Agentes | Registro de agentes conectados | a detalhar |
| Agentes | Sessões do ADK | criadas pelo ADK |
| Negócio | Dados de vendas | dono: script de carga |

## 5. Interfaces

**Convenções**

- Prefixo `/v1` na API do chat e no Serviço de agentes; `/api`, sem versão, no BFF, porque o
  Frontend e o BFF são implantados juntos. Uma mudança que quebra entre serviços sai como nova
  versão do prefixo, em duas implantações.
- Autenticação: o navegador fala com o BFF por cookie de sessão; o BFF leva a sessão à API do chat
  repassando o mesmo cookie no cabeçalho `Cookie`, então a API do chat tem um caminho de
  autenticação só, igual no REST e no WebSocket; o BFF chama o Serviço de agentes com a credencial de serviço; os bots chamam a
  API do chat com a credencial de bot e o identificador de pedido (forma em "Segurança").
- Campos do JSON em `snake_case`, nas três APIs.
- Paginação: keyset pelo id (UUID v7), com `before` (o id do item mais antigo já recebido) e
  `limit`. A resposta traz os itens em ordem cronológica e `has_more`, que diz se há itens mais
  antigos. O padrão e o máximo de `limit` estão em "Valores e configuração", em "Tamanho da
  página".
- Erros: "Conceitos transversais de implementação", seção "Erros".
- Eventos do WebSocket: tipos em `packages/chat-events/`, consumidos por `chat-api` e `web`.

**Índice das rotas**

O índice por domínio (BFF; API do chat, para o BFF e para os bots; Serviço de agentes) e a lista
de eventos do WebSocket estão a definir. As rotas já decididas:

| Método e caminho | Situação | Comportamento |
| --- | --- | --- |
| API do chat: `POST /v1/sessions` | existe | Entrar: "Estados e regras", seção "Sessão e login" |
| API do chat: `GET /v1/sessions/current` | existe | Verificar e renovar a Sessão: mesma seção |
| API do chat: `DELETE /v1/sessions/current` | existe | Sair: mesma seção |
| BFF: Server Actions entrar e sair | existe | Gravam e apagam o cookie: "Conceitos transversais de implementação", seção "Segurança" |
| BFF: `GET /api/session/expired` | existe | Apaga o cookie de uma Sessão que a API recusa e leva a "Entrar": "Cliente", seção "Sessão no cliente" |
| API do chat: `GET /v1/conversations` | existe | As Conversas de que a Pessoa é Membro: spec da F02, seção "Rotas"; com a Última leitura e os números: spec da F07, seção "Rotas" |
| API do chat: `PUT /v1/conversations/:id/read` | existe | Avançar a Última leitura ("Concorrência e idempotência"): spec da F07, seção "Rotas" |
| API do chat: `GET /v1/conversations/:id` | existe | Uma Conversa, pela conferência de participação ("Segurança"): spec da F02, seção "Rotas"; com a Última leitura e os números: spec da F07, seção "Rotas" |
| API do chat: `GET /v1/conversations/:id/messages` | existe | Página do histórico: spec da F02, seção "Rotas" |
| API do chat: `POST /v1/conversations/:id/messages` | existe | Envio sem duplicar ("Concorrência e idempotência"): spec da F02, seção "Rotas"; a Citação: spec da F06, seção "Rotas" |
| API do chat: `PATCH /v1/conversations/:id/messages/:messageId` | existe | Editar a própria Mensagem ("Concorrência e idempotência"): spec da F06, seções "Mensagens" e "Rotas" |
| API do chat: `DELETE /v1/conversations/:id/messages/:messageId` | existe | Apagar a própria Mensagem ("Concorrência e idempotência"): spec da F06, seções "Mensagens" e "Rotas" |
| API do chat: `POST /v1/conversations` | existe | Criar Canal sem duplicar ("Concorrência e idempotência"): [spec da F04](funcionalidades/04-criacao-de-canais-e-convite-para-canal-privado/spec.md), seção "Rotas"; abrir Conversa direta: [spec da F05](funcionalidades/05-busca-de-pessoas-perfil-e-conversa-direta/spec.md), seção "Rotas" |
| API do chat: `GET /v1/conversations/:id/members` | existe | Membros da Conversa: spec da F04, seção "Rotas" |
| API do chat: `POST /v1/conversations/:id/members` | existe | Adicionar ao Canal privado: spec da F04, seção "Rotas" |
| API do chat: `GET /v1/people` | existe | Busca de Pessoas pelo nome ou pelo @usuário, fora dos Membros de uma Conversa ou, sem ela, todas: spec da F04, seções "Busca de Pessoas" e "Rotas"; a mudança: spec da F05, seções "Busca e Perfil" e "Rotas"; só os Membros de uma Conversa (`member_of`): spec da F06, seção "Busca de Pessoas para a lista de menções" |
| API do chat: `GET /v1/people/:id` | existe | Perfil de uma Pessoa: spec da F05, seções "Busca e Perfil" e "Rotas" |
| API do chat: `PUT /v1/people/me/time-zone` | existe | Gravar o fuso da Pessoa da Sessão: spec da F05, seções "Busca e Perfil" e "Rotas" |
| API do chat: WebSocket em `/socket.io`, só pelo transporte `websocket` | existe: conexão, salas, `message.created`, `message.updated`, `message.deleted`, `conversation.member_added`, `conversation.unread` e `activity.unread` com cursor, reenvio na reconexão, `sync`, abertura da Conversa, "digitando" e `session.ended` | Salas e eventos: [spec da F03](funcionalidades/03-tempo-real/spec.md), seções "Conexão" e "Eventos"; o evento da F04: spec da F04, seção "Tempo real"; a Conversa direta no `conversation.member_added`: spec da F05, seção "Tempo real"; `message.updated` e `message.deleted`: spec da F06, seção "Tempo real"; `conversation.unread`: spec da F07, seção "Tempo real"; `activity.unread`: spec da F08, seção "Tempo real" |
| BFF: `GET /api/conversations/:id/messages` | existe | Páginas anteriores do histórico, lidas pelo cliente: "Cliente", "Leituras e tempo real" |
| BFF: `GET /api/conversations`, `GET /api/conversations/:id/members` e `GET /api/people` | existe | Leituras do cliente: a lista de Conversas no `reset`, os Membros e a busca de Pessoas (spec da F04, seção "BFF") |
| BFF: Server Actions `createChannel` e `addMembers` | existe | Criar Canal e adicionar ao Canal privado: spec da F04, seção "BFF" |
| BFF: `GET /api/people/:id` | existe | Perfil: spec da F05, seção "BFF" |
| BFF: Server Action `saveTimeZone` | existe | Gravar o fuso: spec da F05, seção "BFF" |
| BFF: Server Action `openDirectConversation` | existe | Abrir Conversa direta: spec da F05, seção "BFF" |
| BFF: Server Action `editMessage` | existe | Editar a própria Mensagem: spec da F06, seção "BFF" |
| BFF: Server Action `deleteMessage` | existe | Apagar a própria Mensagem: spec da F06, seção "BFF" |
| API do chat: `GET /v1/activity` e `GET /v1/activity/unread` | existe | Notificações da Pessoa, por tipo, e os números de Atividade: [spec da F08](funcionalidades/08-notificacoes-e-atividade/spec.md), seção "Rotas" |
| API do chat: `PUT /v1/activity/read` | existe | Avançar a marca de Atividade ("Concorrência e idempotência"): spec da F08, seção "Rotas" |
| BFF: `GET /api/activity` e `GET /api/activity/unread` | existe | Páginas anteriores de Atividade e os números na reconexão com `reset`, pedidos pelo cliente; rotas, e não Server Actions: spec da F08, seção "BFF" |
| BFF: `PUT /api/activity/read` | existe | A marca de Atividade, pedida pelo cliente: spec da F08, seção "BFF" |
| BFF: `PUT /api/conversations/:id/read` | existe | Avançar a Última leitura, pedido pelo cliente; rota, e não Server Action, porque estes rodam em série: spec da F07, seção "BFF" |
| Envio de mensagem no BFF (Server Action) | existe | Mensagem gravada e agente sem receber o pedido: "Conceitos transversais de implementação", seção "Erros" |

## 6. Estados e regras

As subseções desta parte (pedido ao agente, pergunta pendente, mensagem, consulta a dados de
negócio, limite de pedidos e teto de custo) e as regras de cada uma estão a definir. As regras já
decididas ficam abaixo.

### 6.1 Tarefa

Dois estados: aberta e concluída (HLD 6.6).

- Só o responsável conclui e reabre a tarefa. Outra pessoa, inclusive quem delegou, recebe um
  erro do catálogo.
- Ao concluir ou reabrir, quem delegou é avisado (HLD 6.6).
- Concluir uma tarefa já concluída, ou reabrir uma aberta: a definir.

### 6.2 Sessão e login

Situação: `existe`. Rotas em "Interfaces"; cookie, token e senha em "Conceitos transversais
de implementação", seção "Segurança".

**Entrar**

- O e-mail é normalizado antes de tudo: sem os espaços das pontas e em minúsculas. É assim que
  ele é gravado, comparado e contado no limite.
- E-mail sem conta e senha errada recebem a mesma resposta, `invalid_credentials`, com o mesmo
  corpo.
- Com a credencial certa e o e-mail fora do bloqueio, a API cria uma Sessão com `expires_at` =
  agora + `duração da Sessão` e devolve o token.

**Verificar**

- Token desconhecido, Sessão vencida ou cookie ausente recebem `unauthenticated`, sem distinguir
  os casos. A Sessão vencida é apagada nessa hora.
- Uma Sessão válida é renovada (`expires_at` = agora + `duração da Sessão`) só quando passou o
  `intervalo de renovação da Sessão` desde o `last_used_at`. Assim, quem usa o chat ao menos uma
  vez dentro da `duração da Sessão` não precisa entrar de novo, e o banco recebe no máximo uma
  escrita por Sessão a cada intervalo.

**Sair e revogar**

- Sair apaga a Sessão apresentada. As outras Sessões da mesma Pessoa continuam valendo.
- Revogar é apagar a linha, pelo comando de contas; a próxima requisição com aquela Sessão recebe
  `unauthenticated`. Redefinir a senha revoga todas as Sessões da Pessoa.

**Limite de tentativas** ([ADR 0023](adr/0023-limite-de-login-por-email.md))

**Estados do limite de um e-mail**

```mermaid
stateDiagram-v2
  [*] --> livre: e-mail sem falhas
  livre --> contando: credencial errada
  contando --> contando: credencial errada, abaixo de tentativas de login
  contando --> bloqueado: credencial errada de número tentativas de login dentro da janela
  contando --> livre: login certo
  contando --> livre: janela de tentativas de login vencida
  bloqueado --> bloqueado: qualquer tentativa, sem estender
  bloqueado --> livre: bloqueio do login vencido
```

Legenda: "livre" é o e-mail sem linha de tentativas; o estado vale por e-mail normalizado.

- Só conta a tentativa com entrada válida e credencial errada. Um erro de validação não conta.
- A janela começa na primeira falha. Uma falha depois de vencida a `janela de tentativas de
  login` recomeça a contagem em 1.
- A falha de número `tentativas de login` dentro da janela bloqueia o e-mail por `bloqueio do
  login`.
- Durante o bloqueio, toda tentativa recebe `too_many_login_attempts`, mesmo com a senha certa,
  com o tempo que falta no `Retry-After`. Essas tentativas não contam nem estendem o bloqueio, e
  cada uma gera um log `warn`.
- Um login certo fora do bloqueio apaga a contagem.
- O incremento é atômico, no próprio `UPDATE` do upsert, para duas falhas simultâneas contarem as
  duas.
- A resposta é a mesma para e-mail com e sem conta, para não revelar se o e-mail tem conta.

**WebSocket**

- O handshake lê o cookie e verifica a Sessão como o REST; sem Sessão, recusa com
  `unauthenticated`.
- Sair desconecta na hora os sockets daquela Sessão, e só os dela.
- A cada `intervalo de reconferência da Sessão no WebSocket`, a API reconfere as Sessões das abas
  conectadas, uma vez por Sessão. Se ela venceu ou foi revogada, a API emite `session.ended` e
  desconecta as abas dela. A reconferência renova a Sessão como uma requisição REST, então uma aba
  aberta conta como uso.

### 6.3 Digitando

Situação: `existe`.

- Só a aba que abriu a Conversa, depois da conferência de participação ("Segurança"), recebe e
  repassa o "digitando" daquela Conversa. Ele nunca vai para as abas da própria Pessoa, não é
  guardado e não é reenviado na reconexão (HLD 6.2).
- Quem digita avisa no máximo a cada `intervalo do aviso de digitando`, enquanto o texto não está
  vazio, e avisa que parou ao enviar, ao apagar todo o texto e ao trocar de Conversa.
- Quem vê tira a Pessoa da lista no aviso de que parou ou depois da `expiração do digitando` sem
  novo aviso; a queda da própria conexão esvazia a lista.
- A aba que sai da sala (fecha a Conversa ou abre outra) conta como aviso de que parou: a API o
  repassa aos outros da sala.

## 7. Processos de segundo plano

| Job | Disparo | O que faz | Na falha | Situação |
| --- | --- | --- | --- | --- |
| Relatório em PDF (Worker) | Pedido na fila (HLD 6.5) | HLD 6.5 | Nova tentativa até `tentativas do Worker`; esgotadas, grava "não consegui" (HLD 6.5) | a detalhar |

A idempotência do job (chave no S3 e entrega única) e outras rotinas (retenção dos PDFs,
perguntas pendentes vencidas) estão a definir. Sessões vencidas não têm rotina: são apagadas
quando apresentadas ("Estados e regras", seção "Sessão e login") e pela operação
`purge-expired-sessions` do comando de contas.

## 8. Cliente

**Telas**

| Rota | Acesso | Lê | Ações | Situação |
| --- | --- | --- | --- | --- |
| `/entrar` | Público | Sessão, quando há cookie | Entrar com e-mail e senha | existe |
| `/` (Home) | Sessão | Pessoa da Sessão, lista de Conversas e cookie da última Conversa | Sair | existe: redireciona para a última Conversa ("Cookies do cliente"), se ela está na lista da Pessoa, ou para a primeira da lista; sem Conversas, a Home vazia; com a lista em falha, o erro com "Tentar de novo" |
| `/conversas/[id]` | Sessão; só Membro | Conversa e histórico | Enviar (F02); editar, apagar, citar; "digitando"; botões de resposta pronta | existe: ler e enviar; tempo real e "digitando" planejados (F03); copiar, editar, apagar, mencionar, citar e ir até a Mensagem citada ([spec da F06](funcionalidades/06-acoes-na-mensagem/spec.md), seção "Cliente"); informar a leitura com a aba em foco e abrir na primeira não lida, com o divisor (spec da F07, seção "Cliente"); abrir na Mensagem pedida em `?mensagem=` (spec da F08, seção "Cliente"); o resto a detalhar |
| Layout das telas logadas (barra lateral) | Sessão | Conversas; não lidas e menções na F07 | Abrir conversa; criar Canal; abrir Conversa direta | existe: a lista, no cliente e atualizada pelo tempo real, o diálogo "Criar canal" e "Mensagens diretas", com o diálogo "Nova conversa"; não lidas e menções na barra lateral, com a seção recolhida e a Conversa aberta em foco sem nada de novo (spec da F07, seção "Cliente"); o título da aba e o marcador do Início no rail (spec da F07, seção "Cliente"); o Alerta, a notificação do navegador e a opção no menu da conta, `planejados` (spec da F08, seção "Cliente") |
| `/atividade` | Sessão | Atividade: Menções e Mensagens diretas (F08); Tarefas (F12) | Abrir a mensagem; marcar tudo como lido; concluir e reabrir tarefa | existe: abas Todas, Menções e Mensagens diretas, ícone Atividade no rail com o número, ao carregar a página ([spec da F08](funcionalidades/08-notificacoes-e-atividade/spec.md), seção "Cliente"); o tempo real e marcar tudo como lido (mesma seção); Tarefas a detalhar |
| Painel de perfil (sobre as telas logadas) | Sessão | Perfil próprio e de outras Pessoas | Abrir Conversa direta (F05); editar o próprio Perfil e a presença (F09) | existe: ler o Perfil e abrir a Conversa direta (spec da F05, seção "Cliente"); editar a detalhar |
| Lista de Membros e passo "Adicionar pessoas" (diálogos sobre a Conversa) | Sessão; só Membro; adicionar só em Canal privado | Membros; busca de Pessoas | Adicionar ao Canal privado | existe |
| A definir | Sessão; conectar e desconectar só para administrador | Agentes e estado de conexão | Conectar e desconectar agente | a detalhar |

**Leituras e tempo real.** A página carrega pelos Server Components. No cliente, o SWR guarda as
leituras que o tempo real altera (mensagens, lista de Conversas, não lidas, notificações), e cada evento do WebSocket
atualiza esse cache direto, sem nova requisição. A primeira página do histórico vem do Server
Component, como `fallbackData` do cache; as anteriores vêm do cliente pela rota do BFF
`GET /api/conversations/:id/messages`, porque um Server Action, além de usar POST, roda em série.

**Cookies do cliente.** Gravados pelo navegador, sem `HttpOnly` e sem dado sensível, com `Path=/`,
`SameSite=Lax` e a `validade do cookie de sessão`:

- **Última Conversa:** o id da Conversa aberta, gravado ao abri-la e lido pela Home para
  redirecionar. Fica no navegador, e não na Pessoa, porque o PRD da F02 (história 2) fala do último
  canal visitado naquele navegador.
- **Fuso:** o fuso IANA do navegador. O servidor formata horas e datas com ele e, sem o cookie, usa
  o `fuso padrão`. Se o fuso gravado difere do navegador, o cliente regrava o cookie e renderiza a
  rota de novo. É também o fuso de quem pediu que o BFF leva ao agente (HLD 6.3). O cliente
  também grava o fuso na Pessoa quando ele difere do da Sessão, uma vez por carga, para a hora
  local do Perfil (spec da F05, seção "Cliente", "Fuso").

**Sessão no cliente.**

- O proxy do Next confere só se o cookie de sessão existe; sem ele, manda para "Entrar". A
  validação de verdade é da API do chat.
- O layout das telas logadas verifica a Sessão na API do chat a cada renderização:
  - Com 401, apaga o cookie e manda para "Entrar". Como um Server Component não grava cookie,
    o layout redireciona à rota do BFF `GET /api/session/expired`, que confere a Sessão de novo
    na API e só apaga o cookie se ela ainda responder 401; com 200, volta para a Home.
  - Com falha de rede, 5xx ou tempo esgotado, mostra "Não foi possível verificar sua sessão",
    com "Tentar de novo", e não manda para "Entrar".
- "Entrar", aberta com cookie, faz a mesma verificação:
  - Com 200, vai para a Home.
  - Com 401, apaga o cookie e mostra o formulário.
  - Com falha de rede, 5xx ou tempo esgotado, mostra o formulário sem apagar o cookie.
  - Aberta com `?verificacao=falhou`, mostra o formulário sem verificar. É a marca que a rota
    `GET /api/session/expired` põe quando a reconferência falha depois de um 401: sem ela, a API
    instável faria o navegador alternar sem fim entre "Entrar" e a rota. O formulário tira a
    marca da URL ao abrir, para recarregar a página verificar de novo.
- Qualquer 401 vindo do BFF manda para "Entrar".
- A recusa do handshake do WebSocket com `unauthenticated`, o evento `session.ended` e a
  desconexão pelo servidor mandam para `GET /api/session/expired`, com o `?para=` da página atual.
  Outra falha de conexão tenta de novo, com a faixa de conexão na tela.
- **Voltar para onde ia:** quem é mandado para "Entrar" leva o caminho pedido em `?para=`.
  - Só vale um caminho relativo que começa com `/` e cujo segundo caractere não é `/` nem `\`
    (o navegador trata `/\` como `//`).
  - Sem ele, ou com outro valor, a Pessoa vai para a Home depois de entrar.
- **Histórico depois de sair:**
  - As telas logadas saem com `Cache-Control: no-store`.
  - O layout logado recarrega a página no evento `pageshow` com `persisted`.
  - Assim, nem o cache nem o bfcache mostram conteúdo a quem saiu.

**Notificação do navegador.**

- A permissão do navegador é pedida só quando a pessoa liga a opção (brief, item 6 do escopo), e a
  opção vale por navegador.
- A notificação sai do evento do WebSocket, com o chat aberto em alguma aba (HLD, seção 4), e só
  sem nenhuma aba do chat em foco; com uma aba em foco, sai o Alerta, só nela.
- O clique abre a conversa posicionada na mensagem (`?mensagem=`, que existe).
- Tudo isso `planejado` na [spec da F08](funcionalidades/08-notificacoes-e-atividade/spec.md), seção "Cliente".

**Reação a erros da API.** 401: "Sessão no cliente". Mensagem gravada com erro do agente:
"Conceitos transversais de implementação", seção "Erros".

## 9. Valores e configuração

**Valores de regra**

| Nome | Valor | Onde vale | Constante ou variável |
| --- | --- | --- | --- |
| Limite de pedidos por pessoa | 10 por minuto (brief, RNF "Custo") | Serviço de agentes | A definir |
| Teto de custo por pedido | A definir | Serviço de agentes | A definir |
| Tentativas do Worker | A definir | Worker | A definir |
| Validade da URL do PDF | A definir | API do chat | A definir |
| Duração da Sessão | 30 dias sem uso (PRD da F01, história 3) | API do chat | Variável `SESSION_TTL_DAYS`, padrão 30 |
| Intervalo de renovação da Sessão | 1 dia | API do chat | Constante |
| Validade do cookie de sessão | 400 dias, o teto do Chrome | BFF | Constante |
| Tentativas de login | 5 (PRD da F01, história 2) | API do chat | Constante |
| Janela de tentativas de login | 15 min (PRD da F01, história 2) | API do chat | Constante |
| Bloqueio do login | 15 min (PRD da F01, história 2) | API do chat | Constante |
| Validade do identificador de pedido | A definir | API do chat | A definir |
| Retenção dos eventos de reconexão | 5 min (PRD da F03, história 5) | API do chat (Redis) | Constante |
| Intervalo de reconferência da Sessão no WebSocket | 60 s (spec da F03) | API do chat | Constante |
| Ping do WebSocket | Intervalo de 10 s e espera de 5 s | API do chat | Constante |
| Intervalo do aviso de digitando | 3 s | Web | Constante |
| Expiração do digitando | 5 s (PRD da F03, história 3) | Web | Constante |
| Atraso da faixa de conexão | 3 s (PRD da F03, história 4) | Web | Constante |
| Distância do fim da lista | 100 px: até ela, a Mensagem nova rola a lista | Web | Constante |
| Intervalo do aviso de leitura | 1 s: no máximo um aviso de leitura por Conversa nesse intervalo (spec da F07) | Web | Constante |
| Teto da contagem de não lidas | 100: as contagens de não lidas e de menções param nele, e o contador mostra `99+` (spec da F07); vale também para os números de Atividade (spec da F08) | API do chat e web | Constante |
| Duração do Alerta | 8 s: o Alerta some sozinho depois disso (spec da F08) | Web | Constante |
| Tempo limite da consulta ao Banco de negócio | A definir | Serviço de agentes e Worker | A definir |
| Tamanho da página | Padrão 50, máximo 100 | API do chat | Constante |
| Limite da busca de Pessoas | 20 Pessoas por busca (spec da F04) | API do chat | Constante |
| Espera da busca de Pessoas | 200 ms sem digitar antes de buscar (spec da F04) | Web | Constante |
| Pessoas por adição ao Canal | Até 100 por pedido (spec da F04) | API do chat e web | Constante |
| Formato do @usuário | `a`–`z` sem acento, números, `.`, `_` e `-`; de 2 a 30 caracteres; começa e termina com letra ou número (spec da F05) | API do chat e banco | Constante |
| Tamanho do cargo | De 1 a 80 caracteres, numa linha só (spec da F05) | API do chat e banco | Constante |
| Formato do telefone | De 1 a 30 caracteres: dígitos, espaço, `+`, `-`, `(` e `)` (spec da F05) | API do chat e banco | Constante |
| Tamanho máximo da Mensagem | 4000 caracteres, contados em pontos de código Unicode (Figma, MessageComposer) | API do chat, banco e web | Constante |
| Intervalo da forma compacta | 5 min (PRD da F02, história 3) | Web | Constante |
| Fuso padrão | `America/Sao_Paulo`, usado sem o cookie de fuso | Web | Constante |

**Variáveis de ambiente**

O que cada contêiner recebe está no HLD, seção 8, "Configuração e segredos". As já decididas
(`DATABASE_URL`, `PORT`, `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`, `WEB_ORIGIN`, `REDIS_URL` e `TEST_REDIS_URL` da API do chat e as cinco da Web já existem; as demais são `planejadas`):

| Projeto | Variável | Para quê |
| --- | --- | --- |
| API do chat | `DATABASE_URL` | Conexão com o Banco do chat |
| API do chat | `WEB_ORIGIN` | Origem aceita no handshake do WebSocket |
| API do chat | `REDIS_URL` | Conexão com o Redis |
| API do chat | `TEST_REDIS_URL` | Banco lógico do Redis dos testes |
| API do chat | `SESSION_TTL_DAYS` | `Duração da Sessão` |
| API do chat | `PORT` | Porta HTTP em que a API escuta |
| API do chat | `SESSION_COOKIE_NAME` | Nome do cookie de sessão que o BFF repassa; o mesmo valor da Web |
| Web | `CHAT_API_URL` | Endereço interno da API do chat |
| Web | `SESSION_COOKIE_NAME` | Nome do cookie de sessão |
| Web | `SESSION_COOKIE_DOMAIN` | `Domain` do cookie; vazio no local |
| Web | `SESSION_COOKIE_SECURE` | `Secure` do cookie; `false` no local |
| Web | `CHAT_API_PUBLIC_URL` | Endereço público da API do chat, em que o navegador abre o WebSocket; lido no servidor e passado ao cliente, para a mesma imagem servir a todos os ambientes |

As demais variáveis estão a definir.

## 10. Ambiente de desenvolvimento

Tudo roda em contêineres, pelo `compose.yaml` da raiz (projeto `fullcycle-slack-ia`). O que
substitui cada serviço de produção segue o HLD, seção 9, "Implantação e ambientes".

| Serviço | Imagem | Porta no host | Papel |
| --- | --- | --- | --- |
| `web` | `apps/web/Dockerfile.dev` (Node 26, pnpm 11) | 3000 | Frontend/BFF |
| `chat-api` | `apps/chat-api/Dockerfile.dev` (Node 26, pnpm 11) | 3001 (3000 no contêiner) | API do chat |
| `postgres` | `postgres:18` | 5432 | Banco do chat, dos agentes e de negócio |
| `s3` | `chrislusf/seaweedfs:4.52` (`weed mini`) | 8333 | Substituto do armazenamento compatível com S3, com o bucket `reports` |
| `redis` | `redis:8` | 6379 | Eventos por Pessoa para a reconexão; o banco lógico 1 (`TEST_REDIS_URL`) é dos testes da API do chat |
| `e2e` | Imagem oficial do Playwright, na mesma versão do `@playwright/test` do `web` | — | Roda os testes de ponta a ponta do `web` contra `http://localhost:3000`, encaminhado para a web, e o `playwright-cli`; sobe só pelo `profile` e fica parado, como `web` e `chat-api` |

Entram depois os serviços `agents` e `worker`, quando `apps/agents` existir.

**Contêineres dos apps**

- A imagem não tem dependências. O `CMD` roda `pnpm install --frozen-lockfile` e mantém o
  contêiner de pé; o app sobe na mão: `docker compose exec chat-api pnpm start:dev` e
  `docker compose exec web pnpm dev`. Se o install falha, o contêiner continua de pé e o erro
  fica em `docker compose logs`.
- O repositório inteiro é montado em `/home/node/app`, para o `file:../../packages/chat-events`
  resolver igual dentro e fora. O `node_modules` fica no disco do host, visível para o editor.
- Os contêineres rodam como `node` (uid 1000), o mesmo usuário do host no WSL.
- O store do pnpm fica em `.pnpm-store/` na raiz, ignorado pelo git e compartilhado pelos dois
  apps. A versão do pnpm é a do `packageManager` de cada projeto, igual nos dois.
- Bindings nativos são compilados no contêiner: o Node do host precisa ser o mesmo major (26)
  para rodar ferramentas pelo host sobre o mesmo `node_modules`.

**Postgres.** O script `docker/postgres/init/01-create-databases.sh` roda só com o volume vazio
e cria os bancos `chat`, `agents` e `business`, cada um com um usuário dono de mesmo nome, e o
usuário `business_readonly`, que só conecta no `business` e só lê, inclusive as tabelas que o
script de carga criar depois ([ADR 0013](adr/0013-somente-leitura-banco-e-codigo.md)). Nenhum
usuário conecta num banco que não é o seu. Senhas iguais ao nome do usuário, só locais.

**Diferenças do ambiente local que mudam o código**

- **Cookie de sessão:** localmente é só de host, em `localhost`, sem o atributo `Domain`; os
  cookies não separam portas, então `web` e `chat-api` o recebem. Em produção vale para os
  subdomínios (HLD 6.1).
- **Endereço da API do chat:** o BFF a chama pela rede interna (`http://chat-api:3000`); o
  navegador abre o WebSocket em `localhost:3001` (`CHAT_API_PUBLIC_URL`). São dois endereços
  configurados.
- **Endereço do S3:** a API do chat assina a URL do PDF com o endereço que o navegador alcança
  (`http://localhost:8333`), porque a assinatura inclui o host; o Worker grava pelo endereço
  interno (`http://s3:8333`). São dois endereços configurados, com acesso por caminho
  (path-style).
- **Banco dos testes da API do chat:** `chat_test`, do mesmo dono que o `chat`, para os testes
  não misturarem dados com o desenvolvimento. O `globalSetup` dos testes o apaga e o cria de novo
  a cada execução, conectado como o superusuário local, porque o papel `chat` não tem `CREATEDB`,
  e roda as migrações: os testes não apagam o que criam, e um banco que acumula as Pessoas de todas
  as execuções deixa lento cada Canal público, que inclui todas elas.
- **Contêiner `e2e`:** fica de pé porque o fluxo da skill `playwright-cli` pausa o teste em
  segundo plano (`--debug=cli`) e conecta o `playwright-cli` a ele, e os dois precisam estar no
  mesmo contêiner. O `playwright-cli` é o do `@playwright/test` instalado no `web`, sem instalação
  global, e o relatório HTML não abre sozinho (`PLAYWRIGHT_HTML_OPEN=never` no ambiente do
  serviço).
- **Endereços no contêiner `e2e`:** o navegador do teste abre a web e a API por `localhost`, como o
  da máquina: um encaminhador de portas em Node, que o serviço sobe junto, liga `localhost:3000` a
  `web:3000` e `localhost:3001` a `chat-api:3000`. Com os nomes dos serviços, o cookie de sessão,
  gravado para o host da web, não iria ao WebSocket da API, que é outro host; em `localhost` os
  cookies valem para as duas portas.
- **Dados dos testes da web:** o Playwright roda contra o ambiente de desenvolvimento, no banco
  `chat`. Cada teste cria a própria Pessoa, com e-mail de prefixo `e2e-` no domínio `teste.local`,
  e as Pessoas de teste ficam no banco até serem apagadas pelo prefixo ou por um `down -v`.
- Os nomes das variáveis estão em "Valores e configuração".
- O local não reproduz a rede privada nem a volta automática da PaaS (HLD, seção 9).

## 11. Decisões

| ADR | Decisão | Status |
| --- | --- | --- |
| [0017](adr/0017-projetos-pnpm-independentes.md) | Três projetos pnpm independentes, sem workspace | aceita |
| [0018](adr/0018-typeorm-api-do-chat.md) | TypeORM na API do chat | aceita |
| [0019](adr/0019-socket-io-tempo-real.md) | Socket.IO no tempo real | aceita |
| [0020](adr/0020-dados-de-negocio-pessoa-a-pessoa.md) | Mensagem de dados de negócio emitida pessoa a pessoa no WebSocket | aceita |
| [0021](adr/0021-contadores-gravados.md) | Contadores de não lidas e de menções gravados na transação | substituída pela 0026 |
| [0022](adr/0022-uuid-v7.md) | UUID v7 como id, gerado na aplicação | aceita |
| [0023](adr/0023-limite-de-login-por-email.md) | Limite de tentativas de login contado só pelo e-mail | aceita |
| [0024](adr/0024-conversas-numa-tabela-so.md) | Canais e Conversas diretas numa tabela só, com participação gravada | aceita |
| [0025](adr/0025-membro-da-conversa-direta-na-primeira-mensagem.md) | Na Conversa direta, a outra Pessoa vira Membro na primeira Mensagem | aceita |
| [0026](adr/0026-nao-lidas-calculadas-da-ultima-leitura.md) | Não lidas e menções calculadas a partir da Última leitura | aceita |
| [0027](adr/0027-notificacoes-calculadas.md) | Notificações calculadas a partir das Menções, das Conversas diretas e da Última leitura | aceita |

As decisões que mudam o desenho estão no HLD, seção 10.

## 12. Questões em aberto

**Estrutura e bibliotecas**

- [ ] Biblioteca da fila no Redis (arq, Celery ou RQ).
- [ ] Acesso ao modelo: `LiteLlm` do ADK para os três provedores, ou Gemini nativo e `LiteLlm`
      para OpenAI e Anthropic.
- [ ] Biblioteca do PDF (WeasyPrint, ReportLab ou fpdf2).
- [ ] Acesso ao Banco dos agentes e migrações (SQLAlchemy com Alembic, ou SQL cru); com ela, o
      dono do schema desse banco.
- [x] Biblioteca de validação das variáveis nos projetos TypeScript: zod. No projeto `agents`,
      segue em aberto.
- [ ] Parser da conferência de somente leitura (pglast ou sqlglot).
- [ ] Biblioteca de log estruturado (pino e structlog, ou o logger de cada framework).
- [ ] Porquê das escolhas sem motivo registrado: App Router, SWR, FastAPI próprio, uv; ADRs 0017,
      0018, 0019 e 0022.

**Componentes**

- [ ] Tipos de peça e dependências permitidas na API do chat, no Serviço de agentes e no Worker, e
      no `web`, com o diagrama.
- [ ] Módulos de domínio dos três projetos.
- [x] Como o navegador chama o BFF nas mutações: Server Actions.

**Conceitos transversais**

- [x] `SameSite` do cookie e defesa contra CSRF.
- [x] Formato do identificador de sessão e forma de guardá-lo.
- [ ] Credenciais de bot (por processo ou por agente) e credencial de serviço.
- [x] Chave do limite de tentativas de login: só o e-mail (ADR 0023).
- [x] Origem do IP atrás do proxy: deixou de ser necessária, porque o limite não usa o IP.
- [x] Lugar da conferência de participação: no service de Conversas.
- [ ] Função única que monta a mensagem para cada destinatário.
- [x] Onde a transação começa e como passa entre módulos: no service que orquestra, pelo CLS.
- [x] Publicação do evento depois do commit: direta.
- [x] Quem traduz exceção em resposta na API do chat: o filter global.
- [ ] Quem traduz exceção em resposta no BFF e no Serviço de agentes.
- [ ] Campos de correlação dos logs.
- [ ] O que nunca vai para o log, além do que o HLD já diz.
- [x] Contadores quando a leitura avança até uma mensagem que não é a última da conversa: a
      contagem sai da Última leitura (ADR 0026).

**Dados e interfaces**

- [x] Canais e conversas diretas: uma tabela com tipo (ADR 0024).
- [ ] Bots na mesma tabela das pessoas, ou não.
- [ ] Diagrama de entidades e relações; forma das tabelas.
- [x] Paginação do histórico e das listas: keyset pelo id.
- [x] Como o BFF leva a sessão à API do chat.
- [ ] Índice das rotas (BFF, API do chat para o BFF e para os bots, Serviço de agentes).
- [x] Lista de eventos do WebSocket: o pacote `chat-events`, a partir da F03.

**Estados, regras e processos**

- [ ] Subseções de "Estados e regras": pedido ao agente (estados; resposta a uma pergunta como
      pedido novo ou continuação), pergunta pendente (quando termina), consulta
      a dados de negócio (comparação do lastro), limite de pedidos e teto de custo e presença.
- [ ] Tarefa: concluir uma já concluída, ou reabrir uma aberta.
- [ ] Idempotência do job do PDF (chave no S3, entrega única) e outras rotinas (retenção dos
      PDFs, perguntas pendentes vencidas).

**Valores, configuração e ambiente**

- [ ] Valores de regra marcados "A definir" em "Valores e configuração", e se o limite de pedidos
      é constante ou variável.
- [ ] Nomes, projetos e origem das demais variáveis de ambiente (as da sessão estão decididas).
- [x] Diferenças do ambiente local que mudam o código ou os testes (seção 10).
