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
