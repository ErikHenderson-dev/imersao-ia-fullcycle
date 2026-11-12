# Spec · F13 · Consulta a dados de negócio

2026-11-12 · Luiz Carlos · Status: pronta · PRD: [prd.md](prd.md)

Como a F13 será construída. O que a Pessoa consegue fazer, os critérios de aceite e o que não é
objetivo estão no PRD. As convenções transversais, os valores e as regras já registradas estão no
[LLD](../../lld.md), e esta spec aponta para eles em vez de repeti-los.

## Problema

Perguntas sobre os números do negócio dependem de alguém com acesso ao banco, e o `@assistente`
responde a elas com a recusa curta da F12 (PRD, seção 1, "Resumo executivo").

## Solução

A F13 reaproveita o caminho inteiro do Pedido da F11 e da F12: o disparo pelo BFF, o identificador
de pedido, as rotas `/v1/bot` e a Pergunta pendente. Sobre ele, ela acrescenta:

- a Permissão de dados na Pessoa, ligada por comando de contas e enviada pelo BFF no Pedido
  ([ADR 0015](../../adr/0015-permissoes-enviadas-pelo-bff.md));
- o Banco de negócio com schema e dados fixos, carregados por um script do Serviço de agentes;
- uma ferramenta de consulta com parâmetros sobre um catálogo fixo de Métricas: o modelo escolhe a
  Métrica, as datas e o filtro, e o código monta o SQL, confere que só lê, roda com o usuário só
  leitura, escreve o texto da resposta, confere o lastro e grava a auditoria
  ([ADR 0030](../../adr/0030-catalogo-fixo-de-metricas.md),
  [ADR 0013](../../adr/0013-somente-leitura-banco-e-codigo.md),
  [ADR 0014](../../adr/0014-lastro-antes-de-gravar.md));
- a marca "dados de negócio" na Mensagem e a Resposta bloqueada, montada para cada leitor no REST,
  no WebSocket, na reconexão e na Citação ([ADR 0020](../../adr/0020-dados-de-negocio-pessoa-a-pessoa.md)).

O modelo só decide que o Pedido é uma consulta e escolhe os parâmetros. Quem confere a Permissão de
dados, monta o SQL, escreve o texto, confere o lastro e decide o bloqueio é o código. O fluxo
completo está no PRD, seção 2, "Fluxo", e o desenho, no HLD, seção 6.4.

## Histórias de usuário

As histórias 1 a 8 do PRD (seção 2, "Histórias de usuário") valem como estão, com os critérios de
aceite de lá. Do ponto de vista de quem constrói e opera:

1. Como Serviço de agentes, quero conferir a Permissão de dados no código, antes de tocar o banco,
   para que nenhum erro do modelo consulte em nome de quem não tem permissão.
2. Como Serviço de agentes, quero montar o SQL a partir de parâmetros validados, para que o texto da
   Conversa nunca chegue à consulta.
3. Como Serviço de agentes, quero escrever o texto da resposta a partir do resultado e conferir o
   lastro antes de gravar, para que nenhum número sem lastro chegue a uma Pessoa.
4. Como API do chat, quero montar cada Mensagem para quem vai lê-la, para que o conteúdo de negócio
   nunca saia para quem não tem Permissão de dados, em nenhum caminho.
5. Como quem opera a instalação, quero dar e tirar a Permissão de dados por comando e ver cada
   consulta registrada, para controlar e auditar o acesso.
6. Como quem mantém o Agente, quero uma avaliação com gabarito contra dados fixos, para trocar
   instruções ou modelo sem arriscar um número errado.

## Decisões de implementação

### Permissão de dados (API do chat)

- **Coluna `data_access`** em `people`, booleana, falsa por padrão, `planejada`, numa migração nova.
- **Comando de contas** `set-data-access <e-mail|@usuário> on|off`, no molde do `set-admin`: acha a
  Pessoa por e-mail ou `@usuário`, grava só se mudar e imprime "agora tem / deixou de ter / já
  tinha / já não tinha Permissão de dados". Não publica evento: a mudança vale no próximo Pedido e
  na próxima leitura de cada Mensagem (PRD, "Permissão de dados").
- A Pessoa da Sessão (`PersonResponse`) ganha `data_access`, que o BFF lê para montar o Pedido. O
  Perfil visto pelos outros não a mostra.
- O `USAGE` do comando de contas ganha a linha nova.

### Marca e Resposta bloqueada (API do chat)

- **Coluna `business_data`** em `messages`, booleana, falsa por padrão, `planejada`. Só um bot a
  liga, pela ação de bot; uma Mensagem de Pessoa nunca a tem.
- **Ações `reply` e `question`** ganham o campo opcional `business_data`, falso por padrão. A
  `question` precisa dele porque a pergunta de nome repetido lista nomes de clientes, vendedores
  ou produtos.
- **Função única que monta a Mensagem para cada leitor** (LLD, "Concorrência e idempotência", item
  "Dados de negócio no tempo real"): `toMessageResponse` passa a receber quem vai ler, com a
  Permissão de dados dele. Para uma Mensagem com a marca e um leitor sem permissão, devolve
  `blocked: true`, `body` vazio e `quick_replies` vazio, com o autor, a data e a marca preservados.
  Para os outros casos, `blocked: false`. Toda saída passa por ela: o histórico, a Mensagem nova e a
  editada, a Atividade e as rotas do bot.
- **Citação:** a citação embutida numa Mensagem que cita outra com a marca segue a mesma regra, com
  `quote.blocked`, para cada leitor.
- **WebSocket:** `message.created` e `message.updated` de uma Mensagem com a marca saem com a carga
  por Pessoa, pela função de carga por destinatário que o `publish` já aceita (como `task.created`),
  e o mesmo vale para uma Mensagem sem a marca que cita uma com a marca. O evento guardado na
  reconexão de cada Pessoa é a versão dela (ADR 0020). As outras Mensagens continuam com a carga
  única.
- **`packages/chat-events`:** `MessagePayload` ganha `business_data` e `blocked`, e a citação ganha
  os mesmos dois campos.
- **Conferência do bloqueio:** a Permissão de dados de cada leitor é lida no momento da entrega,
  então quem a perde passa a receber a versão bloqueada já na próxima leitura (PRD).
- **O resumo da F11 não muda:** a leitura de Mensagens pelo bot já traz só Mensagens de Pessoas, e
  a resposta de um Agente nunca entra no resumo.

### Citação enviada ao Agente (web)

- A Server Action de envio manda `quote: null` ao Serviço de agentes quando a citação da Mensagem
  gravada traz `business_data`, mesmo que quem pediu tenha Permissão de dados: o conteúdo de negócio nunca vira título de
  Tarefa (PRD, "A resposta dentro das outras funcionalidades do Agente"). Para o Agente, é um Pedido
  sem Citação.
- O corpo do Pedido ganha `requester.data_access`, lido da Pessoa da Sessão.

### Banco de negócio e script de carga (Serviço de agentes)

- **Script** `apps/agents/scripts/load_business.py`, rodado com `uv run` no contêiner `agents` e com
  a URL do usuário dono (`BUSINESS_OWNER_DATABASE_URL`), que só ele usa. É idempotente: apaga e
  recria as tabelas e os dados numa transação. Os privilégios padrão do init dão leitura ao
  `business_readonly` nas tabelas novas (LLD, "Ambiente de desenvolvimento").
- **Tabelas**, `planejadas`, todas com id inteiro e nomes em inglês, como o resto do projeto:

| Tabela | Colunas |
| --- | --- |
| `customers` | `id`, `name`, `email`, `phone`, `document`, `created_at` |
| `sellers` | `id`, `name` |
| `products` | `id`, `name`, `price` |
| `orders` | `id`, `customer_id`, `seller_id`, `ordered_at` (`timestamptz`), `status` (`paid`, `cancelled`, `pending`), `gross_amount`, `discount`, `net_amount` |
| `order_items` | `id`, `order_id`, `product_id`, `quantity`, `unit_price` |

- Valores em `numeric(12,2)`. Índices em `orders (status, ordered_at)`, `orders (seller_id)`,
  `orders (customer_id)` e `order_items (order_id)`.
- **Dados fixos:** gerados com uma semente fixa, sempre os mesmos, com pedidos de 01/01/2025 a
  31/10/2026 no fuso da empresa. Os dados trazem de propósito nomes que se repetem por trecho (dois
  vendedores com "Ana", seis clientes com "Silva") e um vendedor sem pedidos num mês, para a
  Pergunta pendente de nome, o "nome muito genérico" e o resultado vazio. O volume fica na ordem de
  milhares de pedidos, o bastante para a consulta ser realista e caber no tempo limite.

### Catálogo e consulta (Serviço de agentes)

- **Módulo `app/business/`**, `planejado`, fora de `app/agents/` porque o ADK trata cada entrada
  dali como agente (LLD, "Componentes e dependências"):
  - `catalog.py`: as seis Métricas do PRD ("O que dá para perguntar"), cada uma com a expressão de
    agregação, as tabelas e o rótulo da linha do que foi considerado. O SQL sai de SQLAlchemy Core,
    com parâmetros ligados, e nunca de texto concatenado;
  - `names.py`: a busca do cliente, vendedor ou produto por trecho do nome, sem diferença de
    maiúsculas nem acentos, pela normalização em Python sobre a lista de nomes da tabela, que é
    pequena, sem depender da extensão `unaccent` no Banco de negócio;
  - `readonly.py`: a conferência de somente leitura com o pglast, o parser do próprio Postgres: o
    SQL compilado precisa ser um único `SELECT`, sem `INTO`, sem trava (`FOR UPDATE`) e sem chamada
    de função fora de uma lista permitida (`sum`, `count`, `avg`, `coalesce`). Descartado: sqlglot,
    que reimplementa a gramática e pode divergir do Postgres;
  - `answer.py`: o texto da resposta e da comparação, com os números em pt-BR (moeda com R$ e duas
    casas, contagem inteira, percentual com uma casa e sinal) e a linha do que foi considerado;
  - `lastro.py`: extrai os números do texto final, normaliza o formato pt-BR e confere que cada um
    está no conjunto de números do resultado, das datas do período e dos anos citados na linha. Se
    algum não está, a resposta vira "Não consegui responder." com o desfecho `lastro_blocked`;
  - `db.py`: o motor assíncrono do Banco de negócio, com `BUSINESS_DATABASE_URL` (usuário
    `business_readonly`) e `statement_timeout` igual ao `tempo limite da consulta ao Banco de
    negócio`, definido na conexão;
  - `audit.py`: a gravação da auditoria no Banco dos agentes.
- **Métrica com período:** o intervalo é `[início 00:00, fim + 1 dia 00:00)` no fuso da empresa,
  convertido para UTC na consulta. "Clientes ativos" usa os 90 dias até o fim do período; "clientes
  novos" usa `customers.created_at`; as outras usam `orders.ordered_at` com `status = 'paid'`.
- **Ticket médio** com zero pedidos é resultado vazio, e não divisão por zero.
- **Comparação:** o código consulta os dois períodos e calcula a variação
  `(atual − base) / base`, arredondada a uma casa. Com a base zero, não há variação, e o texto diz
  isso (PRD, "O que dá para perguntar").

### Auditoria (Serviço de agentes)

**Tabela `business_queries`** no Banco dos agentes, `planejada`, numa migração do Alembic:

| Coluna | Tipo |
| --- | --- |
| `id` | UUID v7, chave primária |
| `request_id` | UUID, o identificador do Pedido |
| `requester_id` | UUID da Pessoa |
| `conversation_id` | UUID |
| `question` | texto do Pedido (e da resposta à Pergunta pendente, numa continuação) |
| `params` | jsonb com os parâmetros da ferramenta, anulável |
| `sql` | texto do SQL compilado, sem os valores do resultado, anulável |
| `outcome` | `answered`, `no_permission`, `not_found`, `ambiguous_name`, `too_generic`, `lastro_blocked` ou `error` |
| `created_at` | `timestamptz` |

- Uma linha por chamada da ferramenta de consulta, gravada antes de a resposta ir à API do chat, e
  nunca o resultado (HLD, seção 3, "Auditabilidade"). Falhar ao gravar a auditoria faz o Pedido
  terminar em "não consegui", sem resposta com número.
- A recusa por pergunta fora do catálogo e a pergunta de período não tocam o banco e não entram.
- A retenção segue em aberto (HLD, "Questões em aberto"); a F13 não apaga linhas.

### Rota de Pedido e execução (Serviço de agentes)

- `AgentRequestBody.requester` ganha `data_access`, falso quando ausente, para o BFF anterior
  continuar aceito. O estado do Pedido ganha a Permissão de dados, que nunca vai para as instruções
  do modelo.
- O estado do Pedido também ganha a data de hoje no fuso da empresa, calculada de `requested_at`, que
  vai para as instruções: é a base para "este mês" e "março". Na avaliação, `requested_at` vem do
  caso.
- O fim do Pedido trata as ferramentas novas como trata a pergunta e a Tarefa: o que a ferramenta
  gravou encerra a vez do modelo, e o texto final não vira `reply`.
- O teto de custo não muda: a consulta completa é uma chamada ao modelo e uma à ferramenta, que
  grava e encerra.

### O Agente `assistente` (Serviço de agentes)

- **Instruções**, além das da F11 e da F12:
  - o Agente resume a Conversa, delega Tarefas e responde perguntas sobre os números de vendas; a
    recusa curta passa a dizer as três coisas e o que dá para perguntar;
  - a lista do catálogo, com o que cada Métrica significa, e as regras de período: datas explícitas
    a partir de hoje, mês sem ano é o mais recente já iniciado;
  - sem período, chama `perguntar_periodo`; lista, ranking, série, quebra, contato e alteração
    recebem a recusa curta;
  - a Mensagem citada nunca entra numa consulta, e cada Pedido é completo ("e em abril?" sem o
    resto é pergunta sem o que consultar);
  - numa continuação que não completa a consulta, diz que não entendeu o que consultar, sem
    perguntar de novo.
- **Ferramenta `consultar_dados(metrica, inicio, fim, comparar_inicio?, comparar_fim?,
  filtro_tipo?, filtro_nome?, bruto?)`:**
  1. sem Permissão de dados, grava a recusa sem permissão como `reply` sem a marca, audita
     `no_permission` e encerra, sem tocar o banco;
  2. valida os parâmetros (Métrica do catálogo, datas ISO, início antes do fim, `bruto` só com
     faturamento); inválidos voltam ao modelo como erro, sem consulta;
  3. com filtro, resolve o nome: nenhum achado grava "Não encontrei {tipo} {nome}." como `reply`
     com a marca (`not_found`); dois a cinco gravam a Pergunta pendente de nome com uma Resposta
     pronta por nome completo e a marca (`ambiguous_name`); mais de cinco gravam o pedido de um nome
     mais específico com a marca (`too_generic`);
  4. monta o SQL, passa pela conferência de somente leitura e consulta;
  5. escreve o texto, confere o lastro, audita e grava como `reply` com a marca.
- **Ferramenta `perguntar_periodo()`:** grava a Pergunta pendente "De que período?" com as
  Respostas prontas "Este mês", "Mês passado" e "Este ano", sem a marca, porque não revela dado.
  Como as outras ferramentas de pergunta, recusa rodar numa continuação.
- **Textos fixos:** a recusa sem permissão ("Você não tem acesso a dados de negócio. Peça a
  permissão a quem opera a instalação."), o "Não consegui responder." e os formatos da resposta
  ("Faturamento de março de 2026: R$ 1.234.567,89.", seguido da linha "Considerado: faturamento
  líquido, pedidos pagos, de 01/03/2026 a 31/03/2026, fuso America/Sao_Paulo."). O microtexto final
  é conferido com o Figma na tarefa da tela.
- O `card.py` não muda: a descrição já promete responder sobre os dados do negócio.

### Cliente (web)

- **Resposta bloqueada:** uma Mensagem com `blocked` mostra o avatar, o nome e a marca de Agente e,
  no lugar do texto, o aviso fixo "Resposta com dados de negócio. Você não tem permissão para vê-la."
  Sem Respostas prontas.
- **Citação bloqueada:** a citação com `blocked` mostra o autor e o mesmo aviso, sem texto.
- **Copiar:** numa Mensagem bloqueada, copia o aviso.
- **Resposta com dados, para quem tem permissão:** é uma Mensagem do Agente comum (AgentText), com a
  linha do que foi considerado como segundo parágrafo do texto, sem componente novo.
- **Figma, antes do código:** o Figma é conferido e completado com os frames do PRD ("Todas as
  histórias"), no padrão `<Fluxo> / <Grupo> / <Estado>`, nos dois temas, antes da tarefa da tela.

### Ambiente de desenvolvimento

- O `agents` ganha no `compose.yaml` `BUSINESS_DATABASE_URL`, com o usuário `business_readonly`,
  `BUSINESS_OWNER_DATABASE_URL`, com o usuário `business`, e `BUSINESS_TEST_DATABASE_URL` para os
  testes de integração, num banco `business_test` criado pelo próprio teste, como o `agents_test`.
- `BUSINESS_TIME_ZONE` (padrão `America/Sao_Paulo`) e `BUSINESS_QUERY_TIMEOUT_MS` (padrão 3000)
  entram no `config.py`, com os padrões iguais aos da tabela "Valores e configuração" do LLD.
- O passo a passo do `AGENTS.md` raiz ganha a carga do Banco de negócio depois das migrações, ao
  lado do `create-bot`, e o `set-data-access` para a Pessoa de desenvolvimento.

## Decisões de teste

**O que faz um bom teste aqui:** o teste prova o comportamento externo (a resposta HTTP, a linha no
banco, o que chega a cada socket, o que o Agente grava, o que aparece na tela), e não a forma
interna. Os pontos de teste são os que a F11 e a F12 já usam, mais o Banco de negócio real com os
dados fixos. A forma de cada teste da API do chat está em `.claude/rules/nest-api-testing.md`.

**API do chat, testes de ponta a ponta por HTTP com banco real:**

- a ação `reply` com `business_data` grava a marca, e a `question` também;
- o histórico devolve a versão completa a quem tem Permissão de dados e a bloqueada a quem não tem,
  com `body` e `quick_replies` vazios; tirar a permissão muda a próxima leitura;
- a citação de uma Mensagem com a marca sai bloqueada para quem não tem permissão, no histórico e
  na Atividade;
- uma Mensagem de Pessoa nunca recebe a marca;
- o comando `set-data-access` liga, desliga e responde "já tinha" sem gravar; a Pessoa da Sessão
  traz `data_access`.

**API do chat, teste de ponta a ponta com o servidor real e `socket.io-client`:** uma resposta com a
marca chega completa a quem tem permissão e bloqueada a quem não tem, em `message.created`, e cada
um recebe a sua versão no reenvio da reconexão; uma Mensagem que cita a resposta faz o mesmo com a
citação.

**Serviço de agentes, testes de unidade (`tests/unit`):** o SQL de cada Métrica (compilado, sem
coluna de contato), a conversão do período com o fuso, a busca de nomes sem acento e por trecho, o
texto e a comparação (inclusive base zero e resultado vazio), a extração e a conferência do
lastro, e a conferência de somente leitura recusando `INSERT`, `UPDATE`, `DELETE`, várias
instruções, `SELECT … INTO`, `FOR UPDATE` e função fora da lista.

**Serviço de agentes, testes de integração (`tests/integration`)**, com o Banco de negócio de teste
carregado pelo script e a API do chat falsa da F11:

- cada Métrica, com e sem filtro e na comparação, contra números calculados à mão sobre os dados
  fixos;
- o tempo limite: uma consulta que passa dele termina em "não consegui" com `error` na auditoria;
- o usuário só leitura não consegue escrever no Banco de negócio (a garantia do banco, ADR 0013);
- a ferramenta sem Permissão de dados grava a recusa e a auditoria `no_permission` sem consultar;
- um Pedido real com o modelo real: "quanto faturamos em março?" grava a resposta com a marca e a
  linha de auditoria `answered`; sem período, grava a pergunta, e a continuação "mês passado"
  responde.

**Serviço de agentes, avaliação com o `adk eval`:** um evalset novo, `dados`, com 30 casos e
configuração própria, que somados aos 43 de resumo e de delegação chegam aos 73 do brief. A
ferramenta `consultar_dados` roda de verdade contra o Banco de negócio com os dados fixos, e o
"hoje" do caso é 15/10/2026. Os casos:

- perguntas completas de cada Métrica, com variações de escrita, com filtro por nome e comparação;
- sem período (pergunta com as Respostas prontas), nome repetido (pergunta com os nomes), nome não
  encontrado e nome genérico demais;
- sem Permissão de dados (recusa, nenhuma consulta);
- fora do catálogo: lista, ranking, série, quebra por vendedor, contato e alteração;
- robustez: instruções no Pedido para burlar a permissão ou rodar SQL, uma Mensagem citada com
  outra pergunta, "e em abril?" sozinho, e pedidos de resumo e de delegação que citam números.

As checagens exatas do PRD (seção 3) entram como argumentos esperados de `consultar_dados` e de
`perguntar_periodo`, e o texto das recusas e perguntas, como rubrica do juiz. Como o texto da
resposta é fixo, o número é conferido pela igualdade com o gabarito. A forma de ligar o Banco de
negócio real à avaliação, com o `eval_fixtures.py` deixando `consultar_dados` passar, é decidida no
plano da tarefa da avaliação, consultando o MCP `adk-docs`. A meta continua ≥ 98% dos 73 casos, e a
avaliação fica fora da Verificação completa.

**Web, Vitest para as funções puras:** o texto copiado de uma Mensagem bloqueada e a escolha entre
texto e aviso na Mensagem e na citação.

**Web, testes de ponta a ponta com o Playwright**, escritos pelo fluxo da skill `playwright-cli`,
com o plano de testes da F13 junto dos testes. O Agente começa conectado, o bot criado e o Banco de
negócio carregado. Duas Pessoas em dois contextos do navegador, uma com Permissão de dados e outra
sem:

- com o modelo real, um teste só: a Pessoa com permissão pergunta "quanto faturamos em março de
  2026?", vê o número e a linha do que foi considerado, e a outra vê a Resposta bloqueada, sem
  recarregar;
- os outros estados com o bot agindo direto pela rota `/v1/bot/.../reply` com a marca, sem o modelo:
  a Resposta bloqueada depois de recarregar, a citação bloqueada, a cópia do aviso e a recusa sem
  permissão;
- tudo pelo teclado, e a checagem de acessibilidade com `@axe-core/playwright` na Conversa com uma
  resposta completa e uma bloqueada, nos dois temas, sem violações.

**Medição:** o p95 ≤ 5 s da consulta completa, da Mensagem enviada até a resposta aparecer, com o
modelo padrão, registrado na pasta da tarefa que fecha o caminho.

**Verificações do agente com o `playwright-cli`:** a validação visual em 1440 × 900, nos dois
temas, comparada com o `get_screenshot` dos frames novos (`docs/design-system.md`, "Validação
visual"), registrada na pasta da tarefa da tela.

**Roteiro manual, feito por uma pessoa e registrado na mesma pasta:** a nota 100 de Acessibilidade
do Lighthouse nos dois temas, na Conversa com uma resposta completa e uma bloqueada.

**Exemplos anteriores:** na API do chat, os testes das rotas do bot da F11 e da carga por Pessoa de
`task.created` da F12; no Serviço de agentes, os testes de integração da F11 com a API falsa e o
banco de teste `agents_test`; na web, os testes da Mensagem do Agente e da citação.

## Fora de escopo

- Tudo o que o PRD lista em "O que não é objetivo".
- A retenção e a limpeza da auditoria (HLD, "Questões em aberto").
- O relatório em PDF (F14), que vai reaproveitar o catálogo, a auditoria e o bloqueio.
- O snapshot OpenAPI das rotas que mudam, que segue planejado no LLD.

## Observações

- O glossário ganhou Permissão de dados, Dados de negócio, Resposta bloqueada e Métrica (sessão de
  esclarecimento, Q4, Q5 e Q20).
- Decisão nova com ADR: [ADR 0030](../../adr/0030-catalogo-fixo-de-metricas.md), o catálogo fixo de
  Métricas com o SQL montado pelo código, que fecha o isolamento entre a Conversa e a consulta.
- O HLD mudou em 6.4 (catálogo, isolamento e auditoria), 7 (auditoria no Banco dos agentes,
  produtos no Banco de negócio), 8 ("Idioma e fuso"), 10 (ADR 0030), 11 e 12 (o isolamento e o lugar
  da auditoria saíram; a retenção ficou).
- O LLD muda em "Estrutura do código" (`app/business/`, o script), "Bibliotecas" (pglast),
  "Segurança" (o bloqueio por leitor), "Dados" (`data_access`, `business_data`, Banco de negócio,
  `business_queries`), "Interfaces" (`requester.data_access`, `business_data` nas ações, `blocked`
  na carga), "Valores e configuração" (fuso da empresa, tempo limite) e "Questões em aberto".
- O brief mudou no item 11 do escopo: "pedidos de um vendedor", sem listas, rankings nem séries
  (sessão de esclarecimento, Q1).
- Decididas na sessão de esclarecimento, sem ADR: a auditoria no Banco dos agentes (Q9), a
  Permissão de dados conferida dentro da ferramenta (Q11), o texto montado pelo código (Q17) e o
  fuso da empresa (Q2).
- A Resposta pronta de nome, clicada, vira uma Mensagem de quem pediu com o nome escolhido, visível
  a todos, como se a Pessoa o tivesse escrito: o nome é uma escolha dela, e não um número. A
  pergunta em si, com a lista de nomes, fica bloqueada para quem não tem permissão.
