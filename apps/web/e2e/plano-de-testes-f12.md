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
