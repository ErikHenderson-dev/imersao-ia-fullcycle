# AGENTS.md — Serviço de agentes

Projeto Python com o Google ADK, gerado pelo `agents-cli` e gerenciado pelo uv. A estrutura de
pastas, as bibliotecas e o porquê estão no `docs/lld.md`, seções "Estrutura do código" e
"Componentes e dependências".

## Skills

Carregue antes de mexer no projeto:

- `google-agents-cli-workflow`: o ciclo de desenvolvimento de agentes e as regras de código.
- `google-agents-cli-adk-code`: a API do ADK (agentes, ferramentas, callbacks, estado) e as
  receitas de referência.
- `google-agents-cli-eval`: antes de escrever ou rodar uma avaliação.

As partes dessas skills sobre implantação, Terraform, CI/CD e Google Cloud não se aplicam: a
implantação é numa PaaS (ADR 0004). Quando uma skill diverge deste arquivo, vale este arquivo.

## Agentes

Cada agente tem uma pasta em `app/agents/<agente>/`, com `agent.py` (o `root_agent` e o `App`) e
os arquivos só dele, como `tools.py`. As regras do layout estão no `docs/lld.md`, seção
"Componentes e dependências", em "Agentes no projeto `agents`".

O `agents-cli-manifest.yaml` aponta para um agente só, o `assistente`
(`agent_directory: app/agents/assistente`). É nele que o `eval` e o `run` agem; o `playground`
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
| `uv run agents-cli eval run` | Roda o agente do manifesto sobre `tests/eval/datasets/` e avalia as respostas |
| `uv add <pacote>` | Acrescenta uma dependência ao `pyproject.toml` e ao `uv.lock` |

O lint roda sem o codespell porque ele é um corretor em inglês e acusa os comentários em
português. O `agents-cli lint` e o `agents-cli eval` sincronizam o `.venv` com o extra que cada um
usa (`lint` ou `eval`) e tiram o do outro; o comando seguinte o reinstala sozinho.

O `agents-cli eval run` ainda não roda inteiro: o `eval generate` funciona com a chave do AI
Studio, mas o `eval grade` exige credencial padrão do Google Cloud (ADC), porque o SDK de
avaliação cria um cliente do Cloud Storage antes de avaliar, mesmo com a métrica local. O projeto
não usa o Google Cloud, e a saída fica para a F11 (`docs/lld.md`, "Questões em aberto").

Os testes de integração e o `eval` chamam o Gemini e precisam da `GEMINI_API_KEY` em
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
| Avaliação | `tests/eval/` | O comportamento do agente, com LLM como juiz (`eval_config.yaml` e `datasets/`) |

Nunca escreva teste de unidade ou de integração que confira o conteúdo da resposta do modelo, que
não é determinístico: o comportamento do agente se prova na avaliação.

## Regras de código

- **Preserve o que não foi pedido:** mude só o código que a tarefa pede e mantenha os valores de
  configuração, os comentários e a formatação ao redor.
- **Nunca troque o modelo** sem pedido expresso.
- **Ferramentas do ADK:** importe a instância da ferramenta, e não o módulo:
  `from google.adk.tools.load_web_page import load_web_page`.
- **Python sempre pelo uv:** `uv run python <script>`, nunca o `python` da imagem direto.
- **Erro repetido:** se o mesmo erro aparece três vezes seguidas, pare e ataque a causa em vez de
  tentar de novo.
