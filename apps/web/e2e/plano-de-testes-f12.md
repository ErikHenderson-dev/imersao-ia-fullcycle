# Plano de testes da F12 · Delegação de Tarefa pelo agente

Os cenários do Playwright da F12, por tarefa, escritos pelo fluxo da skill `playwright-cli`. As
Pessoas, os Canais, os bots e as Mensagens são criados direto no banco (`support/database.ts`).

## F12-T01 · Delegar uma Tarefa e ver a confirmação (`agentes/delegar-tarefa.spec.ts`)

O teste segura o `agentsLock`, cria o bot `assistente` se ele não existe, conecta o `assistente` e,
no fim, devolve o estado que achou. É o único teste da F12 com o modelo real, com tempo limite
próprio.

1. **A confirmação da Tarefa chega às duas Pessoas sem recarregar:** com a Ana e o Bruno no Canal,
   a Ana envia "@assistente delega pra @bruno revisar o contrato"; a Mensagem do Agente com
   "Tarefa delegada a Bruno …:" aparece nas duas abas, e o banco tem a Tarefa aberta do Bruno,
   delegada pela Ana.

## F12-T02 · Ver, concluir e reabrir Tarefas (`atividade/tarefas.spec.ts`)

A Tarefa de cada teste é criada pelo bot do teste (`insertBot` com `@usuário` aleatório): o Pedido
sai da página da Ana pela rota de envio (`requestByApi`), e o bot delega pela rota `/v1/bot/.../task`
(`botTask`), sem o modelo nem o Serviço de agentes.

1. **Concluir e reabrir chegam a quem delegou:** a Ana delega ao Bruno; o Bruno vê a Tarefa em
   Recebidas, conclui pelo teclado e vê "Concluída" e "Reabrir"; na aba da Ana, em Delegadas, o
   estado muda sem recarregar e não há botões; o Bruno reabre, e a Ana vê "Aberta".
2. **A Tarefa com o Pedido apagado continua na aba:** com a Mensagem do Pedido apagada, a Tarefa
   mostra "Mensagem apagada" no lugar de "Ver Pedido".
3. **O link com a Tarefa a destaca:** `/atividade?aba=tarefas&tarefa=<id>` foca e destaca a Tarefa.
4. **A aba vazia explica como pedir uma Tarefa:** sem Tarefas, "Nenhuma Tarefa" e a orientação de
   pedir ao Agente.

O teste "tudo pelo teclado" de `atividade/atividade.spec.ts` passa pela aba Tarefas entre Mensagens
diretas e o primeiro item.

## F12-T03 · Notificações de Tarefa (`atividade/notificacao-de-tarefa.spec.ts`)

As Tarefas são criadas pelo bot do teste, como na F12-T02. Cada aba espera o tempo real conectar
antes da delegação: o evento que chega no reenvio da reconexão não alerta.

1. **A Notificação de Tarefa chega, conta e abre a Tarefa:** com o Bruno em Atividade → Todas, a Ana
   delega a ele; o item "Ana … delegou uma Tarefa a você" chega não lido, e os contadores da aba
   Tarefas e do rail mostram 1; o clique abre a aba Tarefas com a Tarefa em destaque, e o contador
   da aba some.
2. **O Alerta da Tarefa recebida e da concluída:** com os dois numa Conversa, o Bruno vê o Alerta da
   Tarefa recebida; ele conclui pela aba Tarefas, e a Ana vê "Bruno … concluiu uma Tarefa".
3. **Sem Alerta com a aba Tarefas aberta:** com o Bruno na aba Tarefas, a delegação sobe o contador,
   sem Alerta.

## F12-T04 · Completar a delegação pela Pergunta pendente (`agentes/pergunta-de-delegacao.spec.ts`)

1. **A pergunta com os candidatos vale só para quem pediu:** a Ana faz o Pedido pela rota de envio;
   o bot do teste grava "Para quem é a Tarefa?" com os botões "Bruno Lima" e "Caio Dias"; os botões
   estão ativos para a Ana e desativados para o Bruno; o clique da Ana vira a Mensagem dela e
   desativa os botões para os dois. A continuação que cria a Tarefa, com o modelo real, é do teste
   de integração do Serviço de agentes.

## F12-T06 · Acessibilidade (`acessibilidade/tarefas-sem-violacoes.spec.ts`)

1. **A aba Tarefas sem violações nos dois temas:** Tarefas recebidas, delegadas, uma concluída e uma
   delegada a si mesma em destaque pelo link, com o foco nela; o axe nos temas claro e escuro, depois
   das transições de cor.
2. **A aba Todas com Notificações de Tarefa sem violações nos dois temas.**
