# 07: Escolher o Recorte por Resposta pronta ou responder sem Menção

**Status:** concluída

**O que construir:** sem Recorte no pedido, o Agente pergunta e oferece "Hoje", "Desde ontem", "A
semana" e "Tudo", cada um com a quantidade de Mensagens. Quem pediu clica num botão ou escreve a
resposta sem mencionar o Agente, e recebe o resumo; os botões aparecem desativados para os outros
Membros e para todos depois que a Pergunta pendente se encerra ou vence. Uma Mensagem que não
responde faz o Agente dizer que não entendeu. Referências:
- spec da F11, "Envio e Pergunta pendente", "Rotas do bot e credencial" (contagens e `question`),
  "Execução do Pedido" (sessão da continuação), "O Agente `assistente`" (`perguntar_recorte`) e
  "Cliente" ("Respostas prontas");
- LLD, "Estados e regras" ("Pedido ao agente e Pergunta pendente") e "Concorrência e idempotência"
  ("Pergunta pendente no envio");
- PRD, histórias 4 e 5.

**Decisões consumidas de outras tarefas:**
- Credencial de bot, validação do Pedido e forma das rotas `/v1/bot`: 03.
- Sessão do ADK por Pedido: 03.
- Apoio de Playwright para agir como bot: 03.
- Conversão do Recorte em UTC, instruções do Agente e mecanismo do evalset: 04.

**Bloqueada por:** 04 (Resumo com Recorte de tempo, por Pessoa e por assunto)

- [x] **CA1** · Antes do código, o Figma ganha a pergunta com as Respostas prontas ativas,
  desativadas para outro Membro e encerradas, nos dois temas.
- [x] **CA2** · `GET /v1/bot/requests/:id/message-counts` devolve as contagens de vários `since` e
  de tudo, iguais às da leitura; `POST /v1/bot/requests/:id/question` grava a pergunta com
  `quick_replies` e abre a Pergunta pendente, encerrando a anterior.
- [x] **CA3** · No envio, sem `agent_username` e com Pergunta pendente aberta e não vencida, a API
  cria um Pedido `continuation` com o `parent_request_id` e encerra a pergunta; com
  `agent_username`, encerra e cria um `new`; Mensagens de outros Membros não a encerram; dois envios
  simultâneos criam um Pedido só.
- [x] **CA4** · Ao encerrar, a Mensagem da pergunta sai em `message.updated` com `closed`, e o
  payload traz `quick_replies { options, owner_id, expires_at, closed }`.
- [x] **CA5** · `perguntar_recorte` grava "Hoje (N)", "Desde ontem (N)", "A semana (N)" e "Tudo
  (N)" com as contagens do banco; a continuação retoma a sessão do Pedido que perguntou, resume o
  Recorte respondido ou diz que não entendeu.
- [x] **CA6** · A função de estado das Respostas prontas cobre o dono, outro Membro, encerrada e
  vencida, no Vitest; os botões ativos disparam com Enter ou Espaço e enviam o texto pelo envio
  comum, e o desativado explica no rótulo acessível que é de quem pediu.
- [x] **CA7** · O evalset ganha os casos de vários turnos (pergunta e resposta escrita, resposta que
  não responde), e o teste de integração prova a pergunta e a continuação na mesma sessão.
- [x] **CA8** · O Playwright prova os botões ativos para quem pediu e desativados para a outra
  Pessoa, o clique virando Mensagem e desativando para as duas, e a pergunta vencida; o axe nos
  dois temas, sem violações; a validação visual fica nesta pasta.
