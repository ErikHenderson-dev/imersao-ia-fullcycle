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

O teste segura o `agentsLock`, cria o bot `assistente` se ele não existe (`insertBot` com o `@usuário` fixo),
conecta o `assistente` e, no fim, devolve o estado que achou. É o único teste da F11 com o modelo
real, com tempo limite próprio.

1. **A resposta do @assistente chega às duas Pessoas sem recarregar:** com a Ana e o Bruno no
   Canal, a Ana envia "@assistente responda só com a palavra olá"; a Mensagem do Agente, com o nome
   e o AgentTag, aparece nas duas abas. Depois, o apoio de bot lê o Pedido que o envio criou
   (`latestAgentRequestOf`, `new` e `open`) e chama a `reply` de novo com outro texto (`botReply`): recebe
   a Mensagem já gravada, e a tela não ganha outra.

**Apoio para agir como bot**, para as próximas tarefas: `latestAgentRequestOf` (`support/database.ts`) lê o
Pedido que o envio criou, e `botReply` (`support/bot.ts`) age pelas rotas `/v1/bot` em `localhost:3001`, com o
`CHAT_BOT_TOKEN` do serviço `e2e`. Num teste sem o modelo, o bot do teste age antes do Serviço de
agentes, e a ação dele depois é a repetição, sem nova Mensagem.

## F11-T04 · Resumo com Recorte (`agentes/resumo-do-agente.spec.ts`)

Como na F11-T03, o teste segura o `agentsLock`, cria o bot `assistente` se ele não existe e conecta o
`assistente`, mas não depende do modelo: o bot do teste responde ao Pedido pelas rotas logo depois do
envio, e a resposta do modelo, depois, é a repetição, sem nova Mensagem.

1. **O resumo chega às duas Pessoas em blocos do AgentText:** com a Ana e o Bruno no Canal, a Ana
   envia "@assistente resume hoje"; o apoio de bot lê o Pedido e grava como `reply` um resumo em
   Markdown (cabeçalho, lista com nomes em negrito, um endereço `https://` e um parágrafo com
   negrito). Nas duas abas, a Mensagem do Agente mostra o cabeçalho em negrito, a lista com um item
   por ponto e o nome em `strong`, o endereço como texto, sem link, e nenhum `**` à vista.

Acessibilidade (`acessibilidade/resumo-do-agente-sem-violacoes.spec.ts`): a Conversa com um resumo
com aviso de teto (cabeçalho, parágrafo e lista) e uma recusa, gravados direto no banco, nos dois
temas, sem violações do axe.
