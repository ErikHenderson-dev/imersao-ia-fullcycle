# Plano de testes da F11 · Resumo de conversa pelo agente

Os cenários do Playwright da F11, por tarefa, escritos pelo fluxo da skill `playwright-cli`. As
Pessoas, os Canais, os bots e as Mensagens são criados direto no banco (`support/database.ts`).

## F11-T01 · A Mensagem pode ter um bot como autor (`agentes/mensagem-do-agente.spec.ts`)

O bot de cada teste é criado com `@usuário` aleatório (`insertBot`), e a Mensagem dele é gravada
direto no banco (`insertMessages`, com o bot como autor), como a resposta do Agente: o teste não depende do
`assistente` nem do estado de conexão dos Agentes.

1. **A Mensagem do Agente no histórico abre o diálogo "Agentes":** a Ana abre o Canal com uma
   Mensagem de bot e vê o nome, o AgentTag "AGENTE" e o texto; clicar no nome abre o diálogo, e Esc
   devolve o foco ao nome; clicar no avatar também abre; Enter no nome abre de novo.
2. **A Mensagem do Agente chega sem recarregar:** com as duas Pessoas no Canal, a Mensagem de bot
   gravada aparece para a Ana ao recarregar (histórico); para o Bruno, ela chega como
   `message.created`, injetado no WebSocket dele pelo `routeWebSocket` com a Mensagem lida da API
   do chat, e aparece sem recarregar, com o AgentTag. Nesta tarefa a API ainda não publica a
   Mensagem de bot: a publicação é da ação `reply`, na F11-T03.

Acessibilidade (`acessibilidade/mensagem-do-agente-sem-violacoes.spec.ts`): a Conversa com a
Mensagem do Agente nas formas completa e compacta, nos dois temas, sem violações do axe.

## F11-T03 · Mencionar o Agente e receber a resposta (`agentes/resposta-do-agente.spec.ts`)

O teste segura o `agentsLock`, cria o bot `assistente` se ele não existe (`ensureAssistantBot`),
conecta o `assistente` e, no fim, devolve o estado que achou. É o único teste da F11 com o modelo
real, com tempo limite próprio.

1. **A resposta do @assistente chega às duas Pessoas sem recarregar:** com a Ana e o Bruno no
   Canal, a Ana envia "@assistente responda só com a palavra olá"; a Mensagem do Agente, com o nome
   e o AgentTag, aparece nas duas abas. Depois, o apoio de bot lê o Pedido que o envio criou
   (`agentRequestOf`, `new` e `open`) e chama a `reply` de novo com outro texto (`botReply`): recebe
   a Mensagem já gravada, e a tela não ganha outra.

**Apoio para agir como bot** (`support/bot.ts`), para as próximas tarefas: `agentRequestOf` lê o
Pedido que o envio criou, e `botReply` age pelas rotas `/v1/bot` em `localhost:3001`, com o
`CHAT_BOT_TOKEN` do serviço `e2e`. Num teste sem o modelo, o bot do teste age antes do Serviço de
agentes, e a ação dele depois é a repetição, sem nova Mensagem.
