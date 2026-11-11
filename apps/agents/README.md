# agents

Serviço de agentes do Full Cycle Chat, em Python com o [Google ADK](https://adk.dev/). Gerado
pelo `agents-cli` versão `1.13.0`.

## Estrutura

```
agents/
├── app/
│   ├── fast_api_app.py        # App HTTP: serve cada agente de app/agents/
│   ├── app_utils/services.py  # Sessões do ADK (Banco dos agentes) e artefatos
│   └── agents/
│       └── assistente/        # Um agente por pasta
│           ├── agent.py       # root_agent e App
│           └── tools.py       # Ferramentas do agente
├── tests/                     # unit/, integration/ e eval/
├── agents-cli-manifest.yaml   # Projeto do agents-cli
├── AGENTS.md                  # Comandos, verificação e regras do projeto
└── pyproject.toml             # Dependências (uv)
```

## Como rodar

Tudo roda no contêiner `agents` do `compose.yaml` da raiz. Os comandos, a verificação completa e
as regras do projeto estão no [`AGENTS.md`](AGENTS.md); a arquitetura, no `docs/lld.md` da raiz.
