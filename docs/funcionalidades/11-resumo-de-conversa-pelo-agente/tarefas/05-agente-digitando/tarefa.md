# 05: O Agente aparece digitando

**Status:** em andamento

**O que construir:** enquanto o Agente trabalha num Pedido, quem está na Conversa vê que ele está
digitando, com o nome dele; o aviso some quando a resposta chega, ou em poucos segundos se o
Serviço de agentes cair no meio. Referências:
- spec da F11, "“Digitando” do bot" e "Cliente" ("Digitando");
- LLD, "Estados e regras" ("Digitando") e "Valores e configuração" ("Intervalo do aviso de
  digitando" e "Expiração do digitando");
- PRD, "Regras desta funcionalidade" (o Agente digitando).

**Decisões consumidas de outras tarefas:**
- Formato do autor: 01.
- Credencial de bot e forma das rotas `/v1/bot`: 03.
- Apoio de Playwright para agir como bot: 03.

**Bloqueada por:** 03 (Mencionar o Agente e receber a resposta na Conversa)

- [ ] **CA1** · Antes do código, o Figma ganha o Agente digitando na Conversa, nos dois temas.
- [ ] **CA2** · O evento de digitando traz `author` no lugar de `person`, e o "digitando" de Pessoa
  continua igual.
- [ ] **CA3** · `POST /v1/bot/requests/:id/typing` emite o "digitando" do bot na Conversa, com as
  mesmas recusas de Pedido das outras rotas, e gravar a resposta emite o fim.
- [ ] **CA4** · O Serviço de agentes avisa ao começar e a cada intervalo do aviso de digitando
  enquanto o Pedido roda.
- [ ] **CA5** · O teste com `socket.io-client` prova o "digitando" do bot com `author.kind` `bot` e o
  fim na resposta.
- [ ] **CA6** · O Playwright prova o aviso com o nome do Agente e o sumiço depois da expiração sem
  renovação; a validação visual fica nesta pasta.
