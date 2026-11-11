# 04: Catálogo do Serviço de agentes com credencial

**Status:** a fazer

**O que construir:** o Serviço de agentes passa a responder, com a credencial de serviço, quais
Agentes a instalação traz e quais estão conectados, e deixa de expor as rotas genéricas do ADK
fora do desenvolvimento. É a base do projeto `agents` para o registro, verificável por HTTP. Esta
tarefa decide:
- o módulo de configuração (`pydantic-settings`);
- o acesso ao Banco dos agentes (SQLAlchemy com Alembic, sem tocar nas tabelas do ADK) e a tabela
  `connected_agents`;
- o catálogo por `card.py` e o módulo `app/registry/`;
- o contrato de `GET /v1/agents`, o formato do Bearer e o segredo de desenvolvimento no Compose;
- os dois jeitos de montar o app pelo `ADK_DEV_ROUTES`;
- a base de testes de integração com o banco `agents_test`.

Referências:
- spec da F10, "Registro de Agentes", "Rotas e credencial", "Ambiente de desenvolvimento" e
  "Decisões de teste";
- LLD, "Estrutura do código", "Segurança", "Valores e configuração" e "Ambiente de
  desenvolvimento";
- `apps/agents/AGENTS.md` e as skills do `agents-cli` (documentação do ADK só pelo MCP
  `adk-docs`);
- [ADR 0008](../../../../adr/0008-agentes-como-modulos.md).

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [ ] **CA1** · O módulo de configuração valida `DATABASE_URL`, `AGENTS_SERVICE_TOKEN`,
  `ADK_DEV_ROUTES`, `SESSION_SERVICE_URI` e `ALLOW_ORIGINS`, e a subida falha com o nome da
  variável obrigatória ausente.
- [ ] **CA2** · O Alembic cria `connected_agents` no banco `agents` e ignora as tabelas de sessão do
  ADK; as migrações rodam à mão no contêiner, como diz o `apps/agents/AGENTS.md`.
- [ ] **CA3** · O `assistente` ganha o `card.py`, com o nome e a descrição do frame "Diálogos /
  Agentes / Admin com conectado"; o catálogo monta um Agente por pasta, com o `slug` igual ao nome
  da pasta, e a subida falha com o nome da pasta quando falta o `card.py`.
- [ ] **CA4** · `GET /v1/agents` devolve o catálogo com `connected`, em ordem de nome, ignora linhas
  de `slug` fora do catálogo e responde `unauthorized` (401, `problem+json`) sem a credencial ou com
  a errada, conferida em tempo constante.
- [ ] **CA5** · Com `ADK_DEV_ROUTES` falso ou ausente, só sobem `/v1` e `GET /health`, e `/run` e
  `/list-apps` respondem 404; com `true`, no Compose, o `adk web`, o `adk eval` e o
  `test_server_e2e.py` continuam funcionando.
- [ ] **CA6** · Os testes de integração rodam contra o `agents_test`, apagado, criado e migrado a
  cada execução, como o `chat_test`, e entram na "Verificação completa" do `apps/agents/AGENTS.md`;
  os testes de unidade cobrem o catálogo e a configuração.
- [ ] **CA7** · O `compose.yaml` passa ao `agents` o `AGENTS_SERVICE_TOKEN` de desenvolvimento, o
  `DATABASE_URL` e o `ADK_DEV_ROUTES=true`.
