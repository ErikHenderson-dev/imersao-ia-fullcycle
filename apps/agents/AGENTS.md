# AGENTS.md — Serviço de agentes

Projeto Python com o Google ADK, gerado pelo `agents-cli` e gerenciado pelo uv. A estrutura de
pastas, as bibliotecas e o porquê estão no `docs/lld.md`, seções "Estrutura do código" e
"Componentes e dependências".

## Skills e documentação do ADK

As skills a carregar e a única forma de consultar a documentação do ADK, o MCP `adk-docs`, estão
no `AGENTS.md` da raiz, seção "Agentes e Google ADK".

As partes dessas skills sobre implantação, Terraform, CI/CD e Google Cloud não se aplicam: a
implantação é numa PaaS (ADR 0004). A avaliação é pelo `adk eval`, e não pelo `agents-cli eval`
(seção "Avaliação"). Quando uma skill diverge deste arquivo, vale este arquivo.

## Agentes

O layout de um agente por pasta, em `app/agents/<agente>/`, está no `docs/lld.md`, seção
"Componentes e dependências", em "Agentes no projeto `agents`".

O `agents-cli-manifest.yaml` aponta para um agente só, o `assistente`
(`agent_directory: app/agents/assistente`). É nele que o `run` age; o `playground`
lista todos os agentes de `app/agents/`. Ao renomear um agente, mude junto o nome no `agent.py` e
o `root_agent_name` e o `app_name` do manifesto.

## Comandos

Todos rodam no contêiner `agents`, a partir da raiz do repositório:

```bash
docker compose -f compose.yaml exec agents <comando>
```

Subir o Serviço de agentes está no `AGENTS.md` da raiz, seção "Subir e derrubar".

| Comando | O que faz |
| --- | --- |
| `uv run agents-cli playground --host 0.0.0.0 --port 8000` | Interface web do ADK com recarga, para conversar com os agentes |
| `uv run agents-cli run "<pedido>"` | Teste rápido: manda um pedido ao agente do manifesto e mostra a resposta |
| `uv run adk run app/agents/<agente>` | Conversa com um agente pelo terminal |
| `uv run agents-cli lint --skip-codespell` | ruff (check e format) e ty |
| `uv run agents-cli lint --fix --skip-codespell` | Corrige o que o ruff consegue e formata |
| `uv run pytest tests/unit` | Testes de unidade |
| `uv run pytest tests/integration` | Testes de integração, com o modelo real |
| `uv run --extra eval adk eval app/agents/<agente> tests/eval/<agente>/<agente>.evalset.json --config_file_path tests/eval/<agente>/test_config.json` | Avaliação de um agente (seção "Avaliação") |
| `uv run alembic upgrade head` | Roda as migrações pendentes do Banco dos agentes (`DATABASE_URL`) |
| `uv run alembic revision --autogenerate -m "<nome>"` | Gera uma migração das tabelas do registro; as de sessão do ADK ficam de fora |
| `uv run python -m scripts.load_business` | Carrega o Banco de negócio com os dados fixos, pelo dono do banco (`BUSINESS_OWNER_DATABASE_URL`); apaga e recria as tabelas |
| `uv add <pacote>` | Acrescenta uma dependência ao `pyproject.toml` e ao `uv.lock` |

O lint roda sem o codespell porque ele é um corretor em inglês e acusa os comentários em
português. O `agents-cli lint` sincroniza o `.venv` só com o extra `lint` e tira o `eval`; por
isso o `adk eval` roda com `uv run --extra eval`, que o reinstala.

As migrações não rodam na subida: rode-as à mão no contêiner, como as da API do chat.

Os testes de integração do registro (`tests/integration/test_registry_routes.py`) usam o banco
`agents_test`, que o `conftest.py` apaga, cria de novo e migra a cada execução, pelo
`TEST_DATABASE_ADMIN_URL` (o superusuário local, porque o papel `agents` não tem `CREATEDB`) e pelo
`TEST_DATABASE_URL`, os dois no `compose.yaml`. Os testes do Banco de negócio usam o banco `business_test`, que o `conftest.py` recria uma vez por
execução pelo `TEST_DATABASE_ADMIN_URL`, com os papéis do init, e carregam com `SET ROLE business`;
o usuário só leitura conecta por `BUSINESS_TEST_DATABASE_URL`. Os testes da rota de Pedido usam o banco lógico 2 do Redis
(`TEST_REDIS_URL`, no `compose.yaml`) para o limite de pedidos. Os outros testes de integração e a avaliação chamam o Gemini e precisam da `GEMINI_API_KEY` em
`apps/agents/.env` (copie do `.env.example`). Mudar o `.env` ou o `compose.yaml` pede
`docker compose -f compose.yaml up -d agents` para as variáveis novas entrarem.

## Verificação completa

1. `uv run agents-cli lint --skip-codespell`
2. `uv run pytest tests/unit`
3. `uv run pytest tests/integration`

## Testes

| Nível | Onde fica | O que exercita |
| --- | --- | --- |
| Unidade | `tests/unit/` | Funções puras e peças isoladas, sem o modelo |
| Integração | `tests/integration/` | O agente com o modelo real e o app HTTP de pé, num processo próprio e numa porta livre; as rotas `/v1` pelo `httpx`, com o app real e o banco `agents_test` |
| Avaliação | `tests/eval/<agente>/` | O comportamento do agente, pelo `adk eval` (seção "Avaliação") |

## Avaliação

Cada agente tem uma pasta em `tests/eval/<agente>/`, com:

- `<agente>.evalset.json`: os casos, no formato de evalset do ADK (pergunta, ferramentas
  esperadas e resposta de referência);
- `test_config.json`: os critérios e os limiares. O do `assistente` usa `tool_trajectory_avg_score`
  (IN_ORDER, 1.0), `rubric_based_final_response_quality_v1` (rubricas gerais no config e as de cada
  caso no `rubrics` dele, com `type` `FINAL_RESPONSE_QUALITY`) e `hallucinations_v1`;
- `fixtures/<conversa>.json`: as Conversas que as ferramentas leem na avaliação. O caso aponta a
  dele em `session_input.state.eval_fixture`, junto do contexto do Pedido (`time_zone`,
  `requested_at`, `request_id`, `mentions`), e o `before_tool_callback` do agente
  (`app/eval_fixtures.py`) responde à ferramenta com a fixture no lugar da API do chat. Sem
  `eval_fixture` no estado, o callback não faz nada. Uma Mensagem com `"bot": true` ou
  `"apagada": true` fica fora da leitura e das contagens, como na rota de leitura do bot.

O `assistente` tem um segundo evalset, `delegacao.evalset.json`, com os casos que chamam
`delegar_tarefa`, e a configuração dele, `test_config_delegacao.json`: o título da Tarefa é texto
livre e não pode ser comparado por igualdade, então a trajetória confere só o nome e a ordem das
ferramentas (`ignore_args`), e o Responsável e o título são conferidos pelo
`rubric_based_tool_use_quality_v1`, com rubricas `TOOL_USE_QUALITY` por caso. O
`eval_expected_assignee` do caso também faz a API do chat da avaliação recusar outro Responsável
(F12-T06). A avaliação
completa do `assistente` são os dois evalsets, cada um com a sua configuração.

A avaliação chama o modelo e o juiz de verdade: ao iterar, rode só os casos que mudaram, com
`<evalset>:<eval_id>,<eval_id>` no lugar do caminho do evalset.

Por que o `adk eval`, e não o `agents-cli eval`, e quais critérios ficam de fora: `docs/lld.md`,
seção "Estrutura do código", linha "Avaliação dos agentes". O histórico de cada execução vai para
`app/agents/<agente>/.adk/eval_history/`, ignorado pelo git. A interface web do ADK (`playground`)
também cria e roda casos, na aba Eval.
