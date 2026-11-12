# 02: Trocar o modelo do Agente por configuração

**Status:** concluída

**O que construir:** quem opera a instalação escolhe o provedor e o modelo de IA do Agente por uma
variável de ambiente, sem mudar código, e o Serviço de agentes não sobe se faltar a chave do
provedor escolhido. Referências:
- spec da F11, "Modelo de IA";
- LLD, "Estrutura do código" ("Acesso ao modelo") e "Valores e configuração";
- product brief, RNF "Modelo de IA".

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [x] **CA1** · `AGENT_MODEL` começando com `gemini` usa o Gemini nativo do ADK, com as 3 tentativas
  que existem; `openai/…` e `anthropic/…` usam o `LiteLlm`.
- [x] **CA2** · O `litellm` vira dependência de execução, `>=1.84`.
- [x] **CA3** · `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` são opcionais, e a configuração falha com o
  nome da variável quando falta a chave do provedor escolhido.
- [x] **CA4** · Os testes de unidade cobrem a escolha por prefixo e a falha por chave ausente.
- [x] **CA5** · O compose e o exemplo de `.env` do Serviço de agentes trazem `AGENT_MODEL` com o
  Gemini padrão.
