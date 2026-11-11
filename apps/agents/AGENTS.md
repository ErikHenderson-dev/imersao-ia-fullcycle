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

Cada agente tem uma pasta em `app/agents/<agente>/`, com `agent.py` (o `root_agent` e o `App`) e
os arquivos só dele, como `tools.py`. As regras do layout estão no `docs/lld.md`, seção
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

| Comando | O que faz |
| --- | --- |
| `uv run uvicorn app.fast_api_app:app --host 0.0.0.0 --port 8000` | Sobe o Serviço de agentes (`http://localhost:3002`, com a interface web do ADK) |
| `uv run agents-cli playground --host 0.0.0.0 --port 8000` | Interface web do ADK com recarga, para conversar com os agentes |
| `uv run agents-cli run "<pedido>"` | Teste rápido: manda um pedido ao agente do manifesto e mostra a resposta |
| `uv run adk run app/agents/<agente>` | Conversa com um agente pelo terminal |
| `uv run agents-cli lint --skip-codespell` | ruff (check e format) e ty |
| `uv run agents-cli lint --fix --skip-codespell` | Corrige o que o ruff consegue e formata |
| `uv run pytest tests/unit` | Testes de unidade |
| `uv run pytest tests/integration` | Testes de integração, com o modelo real |
| `uv run --extra eval adk eval app/agents/<agente> tests/eval/<agente>/<agente>.evalset.json --config_file_path tests/eval/<agente>/test_config.json` | Avaliação de um agente (seção "Avaliação") |
| `uv add <pacote>` | Acrescenta uma dependência ao `pyproject.toml` e ao `uv.lock` |

O lint roda sem o codespell porque ele é um corretor em inglês e acusa os comentários em
português. O `agents-cli lint` sincroniza o `.venv` só com o extra `lint` e tira o `eval`; por
isso o `adk eval` roda com `uv run --extra eval`, que o reinstala.

Os testes de integração e a avaliação chamam o Gemini e precisam da `GEMINI_API_KEY` em
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
| Integração | `tests/integration/` | O agente com o modelo real e o app HTTP de pé, num processo próprio e numa porta livre |
| Avaliação | `tests/eval/<agente>/` | O comportamento do agente, pelo `adk eval` (seção "Avaliação") |

Nunca escreva teste de unidade ou de integração que confira o conteúdo da resposta do modelo, que
não é determinístico: o comportamento do agente se prova na avaliação.

## Avaliação

Cada agente tem uma pasta em `tests/eval/<agente>/`, com:

- `<agente>.evalset.json`: os casos, no formato de evalset do ADK (pergunta, ferramentas
  esperadas e resposta de referência);
- `test_config.json`: os critérios e os limiares, como `tool_trajectory_avg_score` e
  `final_response_match_v2`.

O juiz LLM usa a `GEMINI_API_KEY`, pelo AI Studio. Os critérios que delegam ao serviço de
avaliação do Vertex (`safety_v1` e os `multi_turn_*`) exigem um projeto do Google Cloud e ficam
de fora. O `agents-cli eval` também fica de fora: o `eval grade` dele exige credencial padrão do
Google Cloud (ADC), mesmo com métrica local. O histórico de cada execução vai para
`app/agents/<agente>/.adk/eval_history/`, ignorado pelo git. A interface web do ADK (`playground`)
também cria e roda casos, na aba Eval.

## Regras de código

- **Preserve o que não foi pedido:** mude só o código que a tarefa pede e mantenha os valores de
  configuração, os comentários e a formatação ao redor.
- **Nunca troque o modelo** sem pedido expresso.
- **Ferramentas do ADK:** importe a instância da ferramenta, e não o módulo:
  `from google.adk.tools.load_web_page import load_web_page`.
- **Python sempre pelo uv:** `uv run python <script>`, nunca o `python` da imagem direto.
- **Erro repetido:** se o mesmo erro aparece três vezes seguidas, pare e ataque a causa em vez de
  tentar de novo.
