# Plano da F13-T03: Banco de negócio com dados fixos

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de integração

**Cenário:** Dado o banco `business_test` vazio, com os papéis do init, quando a carga roda como o
papel dono (`business`), então existem as tabelas `customers`, `sellers`, `products`, `orders` e
`order_items` com as colunas da spec, e os índices `orders (status, ordered_at)`,
`orders (seller_id)`, `orders (customer_id)` e `order_items (order_id)`; uma falha no meio da carga
não deixa tabela nenhuma pela metade, porque tudo roda numa transação.

**Teste previsto:** integração, `tests/integration/test_business_load.py`, "cria as tabelas e os
índices da spec" e "a carga que falha no meio não deixa nada".

### CA2

**Marca:** teste de integração

**Cenário:** Dado o banco carregado, quando a carga roda de novo, então o resumo dos dados (a
contagem de cada tabela e uma soma de controle das linhas) é igual ao da primeira carga; os pedidos
vão de 01/01/2025 a 31/10/2026 no fuso `America/Sao_Paulo` e têm os três status (`paid`,
`cancelled`, `pending`).

**Teste previsto:** integração, `tests/integration/test_business_load.py`, "rodar duas vezes dá os
mesmos dados" e "os pedidos cobrem o período e os três status".

### CA3

**Marca:** teste de integração

**Cenário:** Dado o banco carregado, quando se procura nos nomes, então há exatamente dois
vendedores com "Ana", seis clientes com "Silva", e a vendedora Ana Paula Ramos não tem pedido em
julho de 2026 no fuso da empresa (e tem em junho e em agosto).

**Teste previsto:** integração, `tests/integration/test_business_load.py`, "os dados trazem os
nomes repetidos e o mês sem pedidos".

### CA4

**Marca:** teste de unidade

**Cenário:** Dado o ambiente sem `BUSINESS_DATABASE_URL`, quando o Serviço de agentes lê a
configuração, então falha com o nome da variável; com ela, `BUSINESS_TIME_ZONE` vale
`America/Sao_Paulo` e `BUSINESS_QUERY_TIMEOUT_MS` vale 3000 quando ausentes; e a configuração da
carga falha sem `BUSINESS_OWNER_DATABASE_URL`. O `compose.yaml` dá ao `agents` as três URLs
(`BUSINESS_DATABASE_URL` com `business_readonly`, `BUSINESS_OWNER_DATABASE_URL` com `business` e
`BUSINESS_TEST_DATABASE_URL` com `business_readonly` no `business_test`).

**Teste previsto:** unidade, `tests/unit/test_config.py`, o parametrizado das obrigatórias (agora
com `BUSINESS_DATABASE_URL`), "os padrões do Banco de negócio" e "a carga exige a URL do dono".

### CA5

**Marca:** teste de integração

**Cenário:** Dado o `business_test` carregado, quando o usuário `business_readonly` conecta por
`BUSINESS_TEST_DATABASE_URL`, então lê as cinco tabelas e recebe "permission denied" ao tentar
`INSERT`, `UPDATE`, `DELETE` e `CREATE TABLE`.

**Teste previsto:** integração, `tests/integration/test_business_load.py`, "o usuário só leitura lê
as tabelas" e "o usuário só leitura não escreve" (parametrizado).

### CA6

**Marca:** documento

**Cenário:** Quem revisa abre o `AGENTS.md` raiz e acha a carga do Banco de negócio no passo a passo
depois das migrações; o `apps/agents/AGENTS.md` tem o comando na tabela e o `business_test` na
explicação dos testes; e o LLD mostra o script, `app/business/`, o Banco de negócio e as variáveis
como `existe`.

## Contrato

### customers · business · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | `integer` | não | — | chave primária, gerada pela carga |
| `name` | `text` | não | — | — |
| `email` | `text` | não | — | contato: nunca sai numa resposta |
| `phone` | `text` | não | — | contato |
| `document` | `text` | não | — | CPF fictício |
| `created_at` | `timestamptz` | não | — | base de "clientes novos" |

### sellers · business · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | `integer` | não | — | chave primária |
| `name` | `text` | não | — | — |

### products · business · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | `integer` | não | — | chave primária |
| `name` | `text` | não | — | — |
| `price` | `numeric(12,2)` | não | — | preço de tabela |

### orders · business · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | `integer` | não | — | chave primária |
| `customer_id` | `integer` | não | — | → `customers`, sem ação |
| `seller_id` | `integer` | não | — | → `sellers`, sem ação |
| `ordered_at` | `timestamptz` | não | — | — |
| `status` | `text` | não | — | `paid`, `cancelled` ou `pending` |
| `gross_amount` | `numeric(12,2)` | não | — | soma dos itens |
| `discount` | `numeric(12,2)` | não | — | — |
| `net_amount` | `numeric(12,2)` | não | — | bruto menos desconto |

- Índices `orders_status_ordered_at_idx (status, ordered_at)`, `orders_seller_id_idx (seller_id)`,
  `orders_customer_id_idx (customer_id)`.
- `CHECK` `orders_status_check` (`status IN ('paid', 'cancelled', 'pending')`), declarado no
  schema do SQLAlchemy.

### order_items · business · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `id` | `integer` | não | — | chave primária |
| `order_id` | `integer` | não | — | → `orders`, sem ação |
| `product_id` | `integer` | não | — | → `products`, sem ação |
| `quantity` | `integer` | não | — | de 1 a 5 |
| `unit_price` | `numeric(12,2)` | não | — | preço na hora do pedido |

- Índice `order_items_order_id_idx (order_id)`.

## Verificação do contrato

- As cinco tabelas, as colunas e os quatro índices: CA1.
- O `CHECK` de `orders.status`: os três status gravados em CA2; nenhum caminho do produto grava outro
  valor, então o `CHECK` fica como guarda do schema.
- A leitura e a recusa de escrita do `business_readonly`: CA5.

## Decisões

- O schema mora em `app/business/schema.py`, como `Table` do SQLAlchemy Core, e a carga em
  `app/business/load.py` (`load(connection)`), que apaga as tabelas com `DROP TABLE IF EXISTS …
  CASCADE`, cria pelo `metadata.create_all` e insere tudo na transação de quem chama. O catálogo de
  Métricas da F13-T04 usa as mesmas `Table`.
- `scripts/load_business.py` só abre a conexão com `BUSINESS_OWNER_DATABASE_URL`, roda `load` numa
  transação e imprime as contagens. Ele roda com `uv run python -m scripts.load_business` no
  contêiner `agents`, porque o projeto não é instalado como pacote e o `-m` põe o diretório do
  projeto no caminho de importação.
- Os dados saem de um `random.Random(13)` e de listas fixas de nomes; o instante de cada pedido é
  gerado no fuso da empresa (`zoneinfo`) e gravado em UTC, e todo valor monetário é `Decimal`
  arredondado a duas casas. Os volumes: 8 vendedores (dois com "Ana": Ana Beatriz Costa e Ana Paula
  Ramos), 300 clientes (seis com "Silva"), 24 produtos e cerca de 6 mil pedidos (de 7 a 11 por dia),
  com 80% pagos, 10% cancelados e 10% pendentes. Ana Paula Ramos não recebe pedido em julho de
  2026. O cliente de cada pedido é sorteado entre os que já tinham conta no dia.
- O teste de integração recria o `business_test` pelo superusuário (`TEST_DATABASE_ADMIN_URL`), dá
  o `CONNECT` e os privilégios padrão ao `business_readonly` como o init faz no `business`, e roda a
  carga conectado como o superusuário com `SET ROLE business`: as tabelas nascem do dono, e os
  privilégios padrão dão a leitura ao só leitura, sem uma quarta URL de teste.
- No `config.py`, `BUSINESS_DATABASE_URL` é obrigatória no `Settings` (o app HTTP usa a conexão
  só leitura a partir da F13-T04), com `BUSINESS_TIME_ZONE` e `BUSINESS_QUERY_TIMEOUT_MS` de padrões
  iguais aos da tabela "Valores e configuração" do LLD; `BUSINESS_OWNER_DATABASE_URL` fica num
  `BusinessLoadSettings` à parte, que só a carga lê, para o app não receber a credencial do dono. A
  `BUSINESS_TEST_DATABASE_URL` é lida pelo `conftest.py`, como a `TEST_DATABASE_URL`.

## Arquivos e interfaces

- `apps/agents/app/business/__init__.py`, `schema.py` (`metadata`, `customers`, `sellers`,
  `products`, `orders`, `order_items`), `load.py` (`load(connection) -> dict[str, int]`, `SEED`).
- `apps/agents/scripts/__init__.py`, `scripts/load_business.py`.
- `apps/agents/app/config.py`: `Settings.business_database_url`, `business_time_zone`,
  `business_query_timeout_ms`; `BusinessLoadSettings`, `load_business_load_settings()`.
- `apps/agents/tests/integration/conftest.py`: `settings_for` com `business_database_url`;
  fixture `business_test_database_url`.
- `apps/agents/tests/integration/test_business_load.py`, `tests/unit/test_config.py`.
- `compose.yaml`: as três URLs no `agents`; `docker/postgres/init` não muda.
- `AGENTS.md` raiz, `apps/agents/AGENTS.md`.

## Testes existentes que mudam

- `tests/unit/test_config.py`: `BUSINESS_DATABASE_URL` entra nas obrigatórias.
- Os testes de integração que montam `Settings` passam a dar `business_database_url`, pelo
  `settings_for`.

## Mudança de dados

A carga do Banco de negócio, que esta tarefa cria; nenhuma mudança nos bancos do chat e dos
agentes.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra o script, `app/business/`, as tabelas de negócio e as
variáveis como `planejadas`. No fim da tarefa, passam a `existe` pela skill `lld`.
