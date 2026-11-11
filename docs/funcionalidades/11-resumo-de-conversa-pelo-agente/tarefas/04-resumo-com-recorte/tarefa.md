# 04: Resumo com Recorte de tempo, por Pessoa e por assunto

**Status:** a fazer

**O que construir:** a Pessoa pede o resumo de hoje, de desde ontem, da semana, de tudo, do que uma
Pessoa disse ou de um assunto, e o Agente responde na Conversa com o Recorte, a quantidade de
Mensagens e os pontos principais com o nome de quem disse cada um, sem `@usuário`. Num Recorte
acima de 500 Mensagens, avisa o corte; num Recorte vazio, diz que não há Mensagens; a outro pedido,
responde com a recusa curta. O texto aparece nos blocos do AgentText. Referências:
- spec da F11, "Rotas do bot e credencial" (leitura), "O Agente `assistente`" (instruções e
  `ler_mensagens`), "Rota de Pedido" (`mentions`) e "Cliente" ("AgentText");
- LLD, "Dados" (convenções de data) e "Valores e configuração" ("Teto de Mensagens do resumo");
- design system, "Componentes" (AgentText);
- PRD, histórias 1, 2, 3 e 7 (recusa).

**Decisões consumidas de outras tarefas:**
- Credencial de bot, validação do Pedido e forma das rotas `/v1/bot`: 03.
- Cliente da API do chat e sessão do ADK por Pedido: 03.

**Bloqueada por:** 03 (Mencionar o Agente e receber a resposta na Conversa)

- [ ] **CA1** · Antes do código, o Figma ganha a Mensagem do Agente com um resumo, com o aviso de
  teto e com a recusa, nos dois temas.
- [ ] **CA2** · `GET /v1/bot/requests/:id/messages` traz as Mensagens de Pessoas, sem as apagadas,
  entre `since` e `until`, filtradas por `author_username`, da mais antiga para a mais nova, no
  máximo as 500 mais recentes, com o `total` do Recorte; os testes de ponta a ponta cobrem cada
  filtro e o corte.
- [ ] **CA3** · `ler_mensagens(recorte, pessoa?)` converte o Recorte em UTC pelo fuso de quem
  pediu; os testes de unidade cobrem os quatro Recortes, a virada do dia e um fuso diferente do
  padrão.
- [ ] **CA4** · O BFF manda as `mentions` resolvidas e o fuso, e as instruções do `assistente`, em
  português, seguem a spec (só esta Conversa, conteúdo como dado, nomes sem `@usuário`, aviso de
  teto, Recorte vazio, recusa curta); as ferramentas de exemplo saem.
- [ ] **CA5** · A função do AgentText converte `#`, listas, parágrafos e negrito em blocos, e o que
  não reconhece vira parágrafo; o Vitest cobre os casos, e nada vira HTML nem link.
- [ ] **CA6** · O evalset troca os casos de exemplo pelos casos dos seis Recortes, do Recorte vazio,
  do teto e dos pedidos fora de escopo, com as Conversas injetadas por `before_tool_callback`; o
  `test_config` usa `tool_trajectory_avg_score` IN_ORDER 1.0,
  `rubric_based_final_response_quality_v1` e `hallucinations_v1`, e os casos passam.
- [ ] **CA7** · O teste de integração do Serviço de agentes prova um Pedido com Recorte lendo o
  Recorte certo da API falsa e gravando o resumo.
- [ ] **CA8** · O Playwright prova, com o bot agindo pelas rotas, um resumo em blocos do AgentText
  para as duas Pessoas, e o axe nos dois temas, sem violações; a validação visual fica nesta pasta.
