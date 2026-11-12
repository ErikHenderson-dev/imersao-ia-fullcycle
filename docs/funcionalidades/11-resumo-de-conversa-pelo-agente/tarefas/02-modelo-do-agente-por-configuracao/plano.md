# Plano da F11-T02: Trocar o modelo do Agente por configuração

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de unidade

**Cenário:** Dado `AGENT_MODEL` `gemini-3.8-flash`, quando o modelo do Agente é construído, então
ele é o `Gemini` do ADK com esse nome e 3 tentativas. Dado `openai/<modelo>` ou
`anthropic/<modelo>`, com a chave do provedor, então ele é o `LiteLlm` com o valor inteiro como
nome e a chave do provedor. Dado um valor com outro prefixo, então a configuração falha com
`AGENT_MODEL` na mensagem.

**Teste previsto:** unidade, `tests/unit/test_model.py`, "gemini usa o Gemini nativo com 3
tentativas", "openai e anthropic usam o LiteLlm" (parametrizado) e "falha com um provedor
desconhecido".

### CA2

**Marca:** revisão humana

**Cenário:** Quem revisa abre o `apps/agents/pyproject.toml` e encontra `litellm>=1.84` em
`dependencies`, e o `uv.lock` com o `litellm` entre as dependências do projeto, fora do extra
`eval`.

### CA3

**Marca:** teste de unidade

**Cenário:** Dado `AGENT_MODEL` `gemini-…` sem `OPENAI_API_KEY` nem `ANTHROPIC_API_KEY`, quando a
configuração é lida, então ela é aceita. Dado `openai/…` sem `OPENAI_API_KEY` (ausente ou só com
espaços), então a configuração falha com `OPENAI_API_KEY` na mensagem; o mesmo para `anthropic/…`
e `ANTHROPIC_API_KEY`. Dado `AGENT_MODEL` ausente, então falha com `AGENT_MODEL`.

**Teste previsto:** unidade, `tests/unit/test_config.py`, "as chaves dos outros provedores são
opcionais com o Gemini", "falha sem a chave do provedor escolhido" (parametrizado por provedor e
por chave ausente ou vazia) e o caso parametrizado das obrigatórias, que passa a incluir
`AGENT_MODEL`.

### CA4

**Marca:** teste de unidade

**Cenário:** Os testes de CA1 e CA3 são os testes de unidade da escolha por prefixo e da falha por
chave ausente.

**Teste previsto:** os de CA1 e CA3.

### CA5

**Marca:** revisão humana

**Cenário:** Quem revisa abre o `compose.yaml` e encontra, no serviço `agents`, `AGENT_MODEL` com
o padrão `gemini-3.8-flash`; e abre o `apps/agents/.env.example` e encontra `AGENT_MODEL` com o
mesmo padrão, explicando como trocar, e as linhas de `OPENAI_API_KEY` e `ANTHROPIC_API_KEY`.

## Contrato

O contrato não muda: nenhuma rota, evento ou tabela. A configuração ganha `AGENT_MODEL`
(obrigatória), `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` (opcionais), no schema das variáveis
(`apps/agents/app/config.py`).

## Verificação do contrato

Nenhum item de contrato. As variáveis novas são provadas por CA3.

## Decisões

- **Onde o modelo é construído.** Uma função `build_model(settings=None)` em `app/model.py`, fora
  de `app/agents/`, porque o ADK trata cada entrada de `app/agents/` como um agente. Todo agente
  faz `model=build_model()` no `agent.py`; a Runner da F11-T03 e o `adk eval` pegam o modelo pelo
  `root_agent`, sem saber do provedor.
- **Configuração do modelo separada.** `ModelSettings` (`AGENT_MODEL` e as duas chaves) em
  `app/config.py`, e `Settings` passa a herdar dela. O `agent.py` lê só a `ModelSettings`, pela
  `load_model_settings()`, para o `adk run`, o `adk eval` e o playground não exigirem
  `DATABASE_URL` nem `AGENTS_SERVICE_TOKEN`; a subida do app HTTP, pela `load_settings()`, valida as
  duas peças e falha antes de servir.
- **Escolha por prefixo.** `gemini` (sem barra) → `Gemini`, com `HttpRetryOptions(attempts=3)`, como
  hoje; `openai/` → `LiteLlm` com `OPENAI_API_KEY`; `anthropic/` → `LiteLlm` com
  `ANTHROPIC_API_KEY`. Qualquer outro valor falha na configuração com `AGENT_MODEL`, porque um
  prefixo desconhecido iria ao `LiteLlm` sem chave conferida. O `LiteLlm` recebe a chave por
  `api_key`, para a configuração ser a única fonte dela; ele a repassa ao `litellm`.
- **Import do `LiteLlm` sob demanda.** O `litellm` só é importado quando o provedor é OpenAI ou
  Anthropic, porque o import dele é lento e o caminho principal é o Gemini.
- **`GEMINI_API_KEY` segue opcional.** A spec e o LLD ("Valores e configuração") tornam obrigatória
  só a chave de OpenAI e Anthropic, e o LLD ("Ambiente de desenvolvimento", "Chave do modelo")
  mantém o app de pé sem a do Gemini, para as rotas do registro e os testes que não chamam o
  modelo; com o Gemini sem chave, o Agente falha ao chamar o modelo, como hoje.
- **`AGENT_MODEL` sem padrão no código.** O valor tem um dono só, o ambiente: o `compose.yaml` no
  desenvolvimento e a PaaS em produção. Sem a variável, a configuração falha com o nome dela.
- **Compose e `.env`.** No `compose.yaml`, `AGENT_MODEL: ${AGENT_MODEL:-gemini-3.8-flash}`: o
  `environment` do compose tem precedência sobre o `env_file`, então uma linha `AGENT_MODEL` no
  `apps/agents/.env` seria ignorada. Trocar o modelo no desenvolvimento é exportar `AGENT_MODEL`
  ao rodar o `docker compose up`. O `.env.example` traz `AGENT_MODEL` com o padrão num comentário
  que diz isso, para não sugerir uma linha que não vale, e as linhas vazias das duas chaves novas
  (segredos, que ficam no `.env`).
- **`litellm` por `uv add`.** `uv add "litellm>=1.84"` no contêiner; o lock já tem a versão que o
  extra `eval` trazia.

## Arquivos e interfaces

- `apps/agents/app/config.py`: `ModelSettings` (`agent_model`, `openai_api_key`,
  `anthropic_api_key`), `Settings(ModelSettings)`, `load_model_settings()` e a checagem do provedor
  e da chave, usada pelas duas leituras.
- `apps/agents/app/model.py`: novo, `build_model(settings: ModelSettings | None = None) -> BaseLlm`.
- `apps/agents/app/agents/assistente/agent.py`: `model=build_model()`; sai a constante `MODEL`.
- `apps/agents/pyproject.toml` e `uv.lock`: `litellm>=1.84`.
- `compose.yaml`: `AGENT_MODEL` no serviço `agents`.
- `apps/agents/.env.example`: `AGENT_MODEL`, `OPENAI_API_KEY` e `ANTHROPIC_API_KEY`.
- `apps/agents/tests/unit/test_model.py`: novo.

## Testes existentes que mudam

- `tests/unit/test_config.py`: a fixture limpa as variáveis novas e define `AGENT_MODEL`, que passa
  a ser obrigatória.
- `tests/integration/conftest.py`: `settings_for` passa `agent_model`, obrigatório na `Settings`.

## Mudança de dados

Nenhuma.

## Documentos atualizados

- `docs/lld.md`, seção "Componentes e dependências", "Agentes no projeto `agents`": o modelo de
  todo agente vem do `build_model()` de `app/model.py`.
- `docs/lld.md`, seção "Estrutura do código", linha "Acesso ao modelo": o prefixo desconhecido
  falha na configuração e a função que constrói o modelo.
- `docs/lld.md`, seção "Valores e configuração", variáveis: `AGENT_MODEL` obrigatória.
- `docs/lld.md`, seção "Ambiente de desenvolvimento", "Chave do modelo no Serviço de agentes": as
  chaves de OpenAI e Anthropic no mesmo `.env`, e o `AGENT_MODEL` do compose, trocado pelo ambiente
  de quem sobe.
