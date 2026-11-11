# Roteiro manual da F11-T08

A nota de Acessibilidade do Lighthouse nos dois temas, numa Conversa com um resumo do Agente e uma
pergunta com Respostas prontas, que o Playwright não mede (spec da F11, "Decisões de teste",
"Roteiro manual"). Feito por uma pessoa, no Chrome, com o build de produção.

**Situação:** a executar. Quem executa preenche a coluna "Nota obtida", a data e as falhas
apontadas, e marca o CA3 da tarefa quando as quatro notas forem 100.

| # | Tela | Quem | Tema | Nota esperada | Nota obtida |
| --- | --- | --- | --- | --- | --- |
| 1 | Conversa com o resumo e a pergunta | quem pediu (Respostas prontas ativas) | claro | 100 | |
| 2 | Conversa com o resumo e a pergunta | quem pediu (Respostas prontas ativas) | escuro | 100 | |
| 3 | Conversa com o resumo e a pergunta | outro Membro (Respostas prontas desativadas) | claro | 100 | |
| 4 | Conversa com o resumo e a pergunta | outro Membro (Respostas prontas desativadas) | escuro | 100 | |

## Preparar

1. Suba o ambiente como no `AGENTS.md` da raiz ("Subir e derrubar"), com a API do chat e o Serviço
   de agentes de pé, as migrações rodadas e o bot do `assistente` criado
   (`pnpm accounts create-bot assistente Assistente`).
2. Troque o `next dev` pelo build de produção: pare o `pnpm dev` do contêiner `web` e rode
   `docker compose -f compose.yaml exec web pnpm build` e depois
   `docker compose -f compose.yaml exec web pnpm start --hostname 0.0.0.0`, na porta 3000. O Lighthouse
   no `next dev` mede também o overlay de desenvolvimento.
3. Use duas contas que sejam Membros de um Canal só para o roteiro (crie o Canal pela tela, para não
   mexer nas Conversas que você usa no dia a dia). Uma delas, com o papel de administrador, conecta o
   `assistente` pelo diálogo "Agentes", se ele ainda não estiver conectado.
4. Com as duas contas, escreva umas cinco Mensagens no Canal, hoje.
5. Com a primeira conta, envie `@assistente resume hoje` e espere o resumo (cabeçalho, linha do
   Recorte e lista de pontos).
6. Com a mesma conta, envie `@assistente faz um resumo` e espere a pergunta com os quatro botões
   ("Hoje (N)", "Desde ontem (N)", "A semana (N)", "Tudo (N)"). **Não clique em nenhum:** a pergunta
   precisa ficar aberta, e ela vence em 1 hora, então meça dentro desse prazo.

## Medir

Em cada linha da tabela, numa janela anônima do Chrome em 1440 × 900:

1. Entre com a conta da linha (a primeira conta é quem pediu; a segunda, o outro Membro) e abra o
   Canal, rolado até o fim, com o resumo e a pergunta à vista.
2. Ponha o tema da linha pelo botão de tema do Rail.
3. Abra DevTools → Lighthouse, escolha o modo **Snapshot** (o modo Navigation recarrega a página),
   o dispositivo **Desktop** e só a categoria **Accessibility**, e clique em "Analyze page state".
4. Registre a nota na tabela e, se for abaixo de 100, as auditorias que falharam e o elemento
   apontado.

## Registro

- Data, versão do Chrome e do Lighthouse: a preencher.
- Falhas apontadas: a preencher.
