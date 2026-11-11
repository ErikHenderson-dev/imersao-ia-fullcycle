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

## F11-T05 · O Agente aparece digitando (`agentes/agente-digitando.spec.ts`)

O bot de cada teste é criado com `@usuário` aleatório (`insertBot("Assistente")`), e o Pedido nasce
pela rota de envio da API do chat, como a Ana, com o `agent_username` do bot (`requestByApi`, em
`support/bot.ts`): sem passar pelo BFF, o Serviço de agentes não recebe o Pedido, e nenhuma
renovação do modelo interfere. O teste não depende do `agentsLock`.

1. **O Agente aparece digitando e some sem renovação:** com a Ana e o Bruno no Canal, o bot avisa
   que digita (`botTyping`); o Bruno vê "Assistente está digitando…", e o aviso some depois da
   expiração do digitando, sem novo aviso.
2. **O aviso do Agente some quando a resposta chega:** com o bot digitando, ele grava a resposta
   (`botReply`); o aviso some na hora, antes da expiração, e a Mensagem do Agente aparece para o
   Bruno.

## F11-T06 · Falhas e limite de pedidos (`agentes/erro-do-agente.spec.ts`)

Os dois primeiros testes seguram o `agentsLock` e conectam o `assistente`, porque o BFF só cria o
Pedido com o Agente conectado no registro. Parar o Serviço de agentes também derrubaria o registro, e
a Menção viraria texto comum ("Disparo pelo BFF", passo 1); por isso o Serviço de agentes fica de pé
e recusa só o `POST /v1/requests` da Ana, pelas chaves do limite dela no Redis (`support/redis.ts`).

1. **O erro do Agente aparece só para quem pediu e o Pedido fica failed:** com a chave do limite da
   Ana num valor que o Redis não conta (`breakAgentRequestLimit`), o Serviço de agentes responde
   503; a Ana envia "@assistente resume hoje" e vê a Mensagem gravada com "O Assistente não recebeu o
   pedido. Mencione de novo." ao lado; o Bruno vê a Mensagem sem o erro; o Pedido fica `failed`.
2. **Passar do limite mostra o erro de limite a quem pediu:** com os 10 Pedidos do minuto feitos
   (`fillAgentRequestLimit`), o 11º mostra "Muitos pedidos em pouco tempo. Tente de novo em um
   minuto." e fica `failed`.
3. **O não consegui do Agente aparece para as duas Pessoas:** como na F11-T05, o Pedido nasce pela
   rota de envio da API do chat, e o bot do teste grava o texto fixo do "não consegui" pela `reply`;
   a Mensagem do Agente aparece nas duas abas.
