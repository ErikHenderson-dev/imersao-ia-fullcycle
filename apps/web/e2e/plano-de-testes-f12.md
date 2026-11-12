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
