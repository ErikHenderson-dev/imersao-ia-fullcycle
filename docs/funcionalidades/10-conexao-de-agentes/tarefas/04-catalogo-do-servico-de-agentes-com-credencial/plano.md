# Plano da F10-T04: Catálogo do Serviço de agentes com credencial

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de unidade

**Cenário:** Dado o ambiente com as variáveis do projeto, quando `load_settings()` lê a
configuração, então `DATABASE_URL`, `AGENTS_SERVICE_TOKEN` e `ADK_DEV_ROUTES` (falso quando
ausente), `SESSION_SERVICE_URI` e `ALLOW_ORIGINS` (lista separada por vírgula, ou nenhuma) chegam
tipados; sem `DATABASE_URL` ou sem `AGENTS_SERVICE_TOKEN`, a carga falha com
`ConfigError` cuja mensagem traz o nome da variável ausente.

**Teste previsto:** unidade, `tests/unit/test_config.py`.

### CA2

**Marca:** teste de integração

**Cenário:** Dado o banco `agents_test` criado vazio e migrado pelo Alembic, quando o teste lê o
catálogo do Postgres, então `connected_agents` existe com `slug` como chave primária, e uma
tabela de fora dos metadados do registro (como as de sessão do ADK) não aparece na migração
gerada (`include_object` do `env.py`). As migrações rodam à mão no contêiner com `uv run alembic
upgrade head`, como diz o `apps/agents/AGENTS.md`.

**Teste previsto:** integração, `tests/integration/test_registry_routes.py`, "a migração cria
connected_agents"; unidade, `tests/unit/test_migrations_env.py`, "o Alembic ignora as tabelas
fora do registro".

### CA3

**Marca:** teste de unidade

**Cenário:**
- Dado `app/agents/`, quando o catálogo é montado, então o `assistente` aparece com `slug`
  `assistente`, `name` "Assistente" e a descrição do frame 26:33348.
- Dada uma pasta de agentes temporária com dois agentes com `card.py`, então o catálogo tem um
  Agente por pasta, com o `slug` igual ao nome da pasta.
- Dada uma pasta de agente sem `card.py`, então a montagem falha com `CatalogError` cuja mensagem
  traz o nome da pasta.

**Teste previsto:** unidade, `tests/unit/test_catalog.py`.

### CA4

**Marca:** teste de integração

**Cenário:**
- Com a credencial certa, `GET /v1/agents` responde 200 com `agents`, cada um com `slug`, `name`,
  `username` (igual ao `slug`), `description` e `connected`, em ordem de `name`; uma linha de
  `connected_agents` com o `slug` do `assistente` o deixa `connected: true`; uma linha com um
  `slug` fora do catálogo não aparece.
- Sem `Authorization`, com um esquema que não é `Bearer` ou com o segredo errado, responde 401
  `application/problem+json` com `code: unauthorized`.

**Teste previsto:** integração, `tests/integration/test_registry_routes.py`.

### CA5

**Marca:** teste de integração

**Cenário:**
- Com `ADK_DEV_ROUTES` falso, o app responde 404 em `/run` e `/list-apps`, 200 em
  `GET /health` sem credencial, e `GET /v1/agents` funciona.
- Com `ADK_DEV_ROUTES` verdadeiro, `/list-apps` traz o `assistente` e `GET /v1/agents` funciona no
  mesmo app; o `test_server_e2e.py`, que sobe o Uvicorn com o ambiente do Compose, continua
  passando.

**Teste previsto:** integração, `tests/integration/test_registry_routes.py`, "sem as rotas do ADK"
e "com as rotas do ADK", e o `tests/integration/test_server_e2e.py` sem mudança.

### CA6

**Marca:** documento

**Cenário:** Quem revisa abre `tests/integration/conftest.py` e encontra o `agents_test` apagado,
criado e migrado uma vez por execução, conectado pelo `TEST_DATABASE_ADMIN_URL`; e o
`apps/agents/AGENTS.md`, em "Verificação completa" e "Comandos", com os testes de integração, a
migração e o `TEST_DATABASE_URL`.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre o `compose.yaml` e encontra, no serviço `agents`,
`AGENTS_SERVICE_TOKEN` com o segredo fixo de desenvolvimento, `DATABASE_URL`,
`ADK_DEV_ROUTES: "true"`, `TEST_DATABASE_URL` e `TEST_DATABASE_ADMIN_URL`.

## Contrato

### connected_agents · agents · nova

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `slug` | `text` | não | — | O `slug` do Agente, nome da pasta em `app/agents/` |
| `connected_by` | `uuid` | não | — | A Pessoa que conectou, sem chave estrangeira (está no Banco do chat) |
| `created_at` | `timestamptz` | não | `now()` | |
| `updated_at` | `timestamptz` | não | `now()` | |

- Chave primária: `slug`. Sem índice além dela.

### `GET /v1/agents` · nova

- Autenticação: `Authorization: Bearer <AGENTS_SERVICE_TOKEN>`.
- Parâmetros: nenhum.
- Resposta de sucesso: 200, `{ "agents": [{ "slug", "name", "username", "description",
  "connected" }] }`, todos obrigatórios, `connected` booleano, em ordem de `name`.
- Erros: 401 `unauthorized`.

### `GET /health` · nova

- Pública, sem credencial, só com `ADK_DEV_ROUTES` falso. 200 `{ "status": "ok" }`.

## Verificação do contrato

- `connected_agents`, a chave primária e a migração: CA2.
- `GET /v1/agents` com sucesso, a ordem e o filtro de `slug` fora do catálogo: CA4.
- `GET /v1/agents` 401 `unauthorized`: CA4.
- `GET /health` e as rotas do ADK ausentes: CA5.

## Decisões

- **Erro do Serviço de agentes.** `app/problems.py` define `ProblemError(status, code, detail)` e
  um handler do FastAPI que o traduz no corpo do LLD ("Erros"), com `type: about:blank`, `title`
  pela frase do status e `content-type: application/problem+json`. A dependência da credencial e,
  nas próximas tarefas, as rotas de conexão lançam `ProblemError`. Isso preenche o "quem traduz
  está a definir" do LLD para o Serviço de agentes.
- **Credencial como dependência do router.** `require_service_token`, em `app/registry/auth.py`,
  lê o `Authorization`, exige o esquema `Bearer` e compara o segredo com `hmac.compare_digest`
  sobre bytes. Ela fica no `APIRouter(prefix="/v1", dependencies=[...])`, para nenhuma rota `/v1`
  nascer sem ela.
- **Configuração.** `app/config.py`, com `Settings(BaseSettings)` do `pydantic-settings` e
  `load_settings()`, que troca o `ValidationError` por `ConfigError("Variável de ambiente
  obrigatória ausente: DATABASE_URL")`. `ALLOW_ORIGINS` fica como texto e vira lista numa
  propriedade, para não exigir JSON na variável. O `services.py` gerado continua lendo
  `SESSION_SERVICE_URI` do ambiente, porque o registro do ADK o chama fora do app; a
  configuração só a valida.
- **App por fábrica.** `create_app(settings)` em `app/fast_api_app.py` monta um dos dois apps pelo
  `adk_dev_routes`, guarda o engine do SQLAlchemy em `app.state` e o fecha no `lifespan`. O módulo
  continua exportando `app = create_app(load_settings())`, que o Uvicorn, o `adk web` e o
  `test_server_e2e.py` usam.
- **Catálogo.** `app/registry/catalog.py`, com `AgentCard(slug, name, description)` e
  `load_catalog(agents_dir)`, que lê o `card.py` de cada subpasta de `app/agents/` (fora as que
  começam com `_` ou `.`) por `importlib.util.spec_from_file_location`, sem importar o `agent.py`.
  O app monta o catálogo uma vez, na criação, e uma pasta sem `card.py` faz a criação falhar.
- **Registro.** `app/registry/store.py`, com a `Table` do SQLAlchemy Core em `REGISTRY_METADATA` e
  `connected_slugs(engine)`. A leitura cruza com o catálogo, e a linha de `slug` fora dele é
  ignorada, sem ser apagada.
- **Alembic.** `apps/agents/alembic.ini` e `apps/agents/migrations/` (`env.py` assíncrono com o
  asyncpg). O `env.py` lê o `DATABASE_URL` pela configuração, usa `REGISTRY_METADATA` como
  `target_metadata` e um `include_object` que só aceita tabelas dele, para o autogenerate nunca
  tocar nas tabelas de sessão do ADK. A primeira migração cria `connected_agents`.
- **Banco dos testes.** `tests/integration/conftest.py` apaga e cria o `agents_test` (dono
  `agents`) pelo `TEST_DATABASE_ADMIN_URL`, roda `alembic upgrade head` com `DATABASE_URL` igual ao
  `TEST_DATABASE_URL` e entrega um app de cada modo pelo `httpx.ASGITransport`, com o lifespan
  rodando. O papel `agents` não tem `CREATEDB`, como o `chat`.
- **Segredo de desenvolvimento.** `AGENTS_SERVICE_TOKEN: dev-agents-service-token` no `compose.yaml`,
  o mesmo valor que a 05 passa à web.

## Arquivos e interfaces

- `apps/agents/pyproject.toml` e `uv.lock`: `pydantic-settings` e `alembic`.
- `apps/agents/app/config.py`: `Settings`, `ConfigError`, `load_settings()`.
- `apps/agents/app/problems.py`: `ProblemError`, `install_problem_handler(app)`.
- `apps/agents/app/registry/__init__.py`, `catalog.py`, `store.py`, `auth.py`, `routes.py`:
  `AgentCard`, `CatalogError`, `load_catalog`, `REGISTRY_METADATA`, `connected_agents`,
  `connected_slugs`, `require_service_token`, `build_router(catalog)`.
- `apps/agents/app/agents/assistente/card.py`: `NAME`, `DESCRIPTION`.
- `apps/agents/app/fast_api_app.py`: `create_app(settings)` e `app`.
- `apps/agents/alembic.ini`, `apps/agents/migrations/env.py`, `script.py.mako`,
  `versions/0001_connected_agents.py`.
- `apps/agents/tests/unit/test_config.py`, `test_catalog.py`, `test_migrations_env.py`.
- `apps/agents/tests/integration/conftest.py`, `test_registry_routes.py`.
- `compose.yaml`: variáveis do serviço `agents`.
- `apps/agents/AGENTS.md`: a migração, os testes de integração do registro e o banco de testes.

## Testes existentes que mudam

- `tests/unit/test_dummy.py` sai, substituído pelos testes de unidade reais.

## Mudança de dados

Nenhuma. O Agente começa desconectado: a tabela nasce vazia.

## Documentos atualizados

- `docs/lld.md`, seção "Erros": no Serviço de agentes, o handler de `ProblemError` traduz os
  erros, no lugar de "a definir".
