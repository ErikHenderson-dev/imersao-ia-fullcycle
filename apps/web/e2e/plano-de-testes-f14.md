# Plano de testes da F14 · Relatório em PDF

Os cenários do Playwright da F14, por tarefa, escritos pelo fluxo da skill `playwright-cli`. As
Pessoas, os Canais, os bots e a Permissão de dados são gravados direto no banco
(`support/database.ts`).

## F14-T01 · Aviso de início e falha (`agentes/relatorio-aviso-e-falha.spec.ts`)

O bot de cada teste é criado com `@usuário` aleatório (`insertBot`): o Pedido sai da página da Ana
pela rota de envio (`requestByApi`), o bot grava o Aviso de início pela rota
`/v1/bot/.../report-started` (`botReportStarted`) e o Worker grava a falha pela
`/v1/bot/.../report-failed`, com a credencial dele (`workerReportFailed`), sem o modelo nem o
Serviço de agentes. A Ana tem Permissão de dados (`setDataAccessOf`); o Bruno, não.

1. **O aviso e a falha aparecem completos para quem tem permissão e bloqueados para a outra
   Pessoa:** a Ana vê o aviso e "@<usuário dela>, não consegui gerar o relatório.", com a Menção
   destacada; o Bruno vê as duas Mensagens como Resposta bloqueada, sem recarregar.
2. **A Notificação da falha leva à Mensagem:** a Ana abre Atividade, vê "<Agente> mencionou você"
   com o texto da falha, ativa o item pelo teclado e cai na Mensagem da falha, destacada.

## F14-T02 · Entrega com o cartão e o download (`agentes/relatorio-entrega.spec.ts`)

Como na T01, com o PDF de exemplo gravado no S3 do contêiner na chave do Pedido
(`support/s3.ts`) antes de o Worker entregar pela rota `/v1/bot/.../report-delivered`
(`workerReportDelivered`). O navegador do teste segue a URL assinada por `localhost:8333`, que o
`port-forward.mjs` liga ao S3.

1. **A entrega mostra o cartão a quem tem permissão e a Resposta bloqueada à outra Pessoa:** a Ana
   vê "@<usuário dela>, o relatório está pronto." com o cartão (nome, tamanho em KB e "Baixar"), sem
   recarregar e depois de recarregar; o Bruno vê o aviso e a entrega como Resposta bloqueada, sem
   cartão nem link.
2. **Baixar baixa o PDF para quem tem permissão:** a Ana aciona "Baixar" pelo teclado e recebe o
   arquivo com o nome do Relatório, que começa com `%PDF`.
3. **O link do relatório responde 403 para quem não tem permissão e 404 sem relatório:** o Bruno
   abre `/api/messages/<id>/report` e vê "Você não tem permissão para baixar este relatório." (403);
   um id sem relatório mostra "Relatório não encontrado." (404).

## F14-T04 · Pedir o Relatório ao Agente (`agentes/relatorio-pdf.spec.ts`)

Com o modelo real, o Serviço de agentes e o Worker rodando e o Banco de negócio carregado. O teste
segura o `agentsLock`, cria o bot `assistente` se ele não existe e o conecta, como na F13.

1. **A Pessoa com permissão pede o Relatório, segue conversando e baixa o PDF:** a Ana pede
   "@assistente me manda um relatório de março de 2026 em PDF", vê o Aviso de início com as datas,
   envia outra Mensagem, vê a entrega com o cartão e baixa um arquivo que começa com `%PDF`; o Bruno
   vê o aviso e a entrega como Resposta bloqueada, sem recarregar.

## F14-T07 · Acessibilidade (`acessibilidade/relatorio-sem-violacoes.spec.ts`)

1. **A Conversa com a entrega completa e a bloqueada passa no axe nos dois temas:** o Bruno, com
   Permissão de dados, pede o Relatório pela rota de envio; o bot grava o aviso e o Worker entrega
   o PDF de exemplo. O axe em `main` não acusa violações na página do Bruno (com o cartão) nem na
   da Ana (sem a permissão, com a Resposta bloqueada), nos temas claro e escuro.

## F14-T07 · Medição (`medicao/relatorio-p95.medicao.ts`)

Fora da suíte, pelo `playwright.medicao.config.ts`, com o modelo real e o Worker rodando: 10
Pedidos de Relatório completos, cada um num Canal novo, medindo da Mensagem enviada até o Aviso de
início e até a entrega aparecerem para quem pediu.
