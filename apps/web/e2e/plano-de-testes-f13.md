# Plano de testes da F13 · Consulta a dados de negócio

Os cenários do Playwright da F13, por tarefa, escritos pelo fluxo da skill `playwright-cli`. As
Pessoas, os Canais, os bots e a Permissão de dados são gravados direto no banco
(`support/database.ts`).

## F13-T02 · Resposta bloqueada (`agentes/resposta-bloqueada.spec.ts`)

O bot de cada teste é criado com `@usuário` aleatório (`insertBot`): o Pedido sai da página da Ana
pela rota de envio (`requestByApi`), e o bot responde pela rota `/v1/bot/.../reply` com
`business_data` (`botReply`), sem o modelo nem o Serviço de agentes. A Ana tem Permissão de dados
(`setDataAccessOf`); o Bruno, não.

1. **A resposta marcada aparece bloqueada, sem recarregar e depois de recarregar:** a Ana vê o
   número; o Bruno vê "Resposta com dados de negócio. Você não tem permissão para vê-la." sem o
   número, em tempo real e depois de recarregar a página.
2. **A citação da resposta marcada aparece bloqueada:** a Ana responde citando a resposta; ela vê a
   citação com o número, e o Bruno vê a citação com o aviso.
3. **Copiar a resposta bloqueada copia o aviso:** o Bruno aciona "Copiar texto" pelo teclado, vê
   "Texto copiado", e a área de transferência tem o aviso.

## F13-T02 · Acessibilidade (`acessibilidade/resposta-bloqueada-sem-violacoes.spec.ts`)

1. **A Conversa com resposta completa e bloqueada passa no axe nos dois temas:** o Bruno pede duas
   vezes, o bot responde uma sem e uma com a marca, e a Ana, sem Permissão de dados, abre a
   Conversa; o axe em `main` não acusa violações no tema claro nem no escuro.

## F13-T04 · Perguntar um número (`agentes/consulta-a-dados.spec.ts`)

O teste segura o `agentsLock`, cria o bot `assistente` se ele não existe, conecta o `assistente` e,
no fim, devolve o estado que achou. É o teste da F13 com o modelo real, com tempo limite próprio, e
precisa do Banco de negócio de desenvolvimento carregado (`scripts.load_business`).

1. **A pergunta de faturamento responde com o número para quem tem permissão e bloqueada para o
   outro:** a Ana, com Permissão de dados, envia "@assistente quanto faturamos em março de 2026?";
   ela vê "Faturamento de março de 2026: R$ …" e a linha "Considerado: faturamento líquido, pedidos
   pagos, de 01/03/2026 a 31/03/2026", e o Bruno vê a Resposta bloqueada, sem o número, sem
   recarregar.
