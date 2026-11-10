# Plano de testes da F08 · Notificações e Atividade

Os cenários do Playwright da F08, por tarefa, escritos pelo fluxo da skill `playwright-cli`. As
Pessoas, os Canais, as Conversas diretas, as Mensagens e as Menções são criados direto no banco
(`support/database.ts`), e a Home abre um primeiro Canal vazio, que fica lido.

## F08-T01 · Atividade ao carregar a página (`atividade/atividade.spec.ts`)

1. **A Atividade lista as Menções e as Mensagens diretas:** uma Menção num Canal e uma Mensagem
   numa Conversa direta aparecem em `/atividade`, a mais nova em cima, não lidas e com o nome
   acessível do item; Enter no item abre a Conversa.
2. **Rolar carrega as Notificações mais antigas:** com 60 Mensagens diretas, a página mostra 50 e,
   ao rolar até o fim, as 60.
3. **O rail mostra Atividade com o número de não lidas:** o link diz "Atividade, 2 não lidas"; em
   `/atividade` ele fica ativo e o Início não, e o marcador do Início da F07 aparece ali.
4. **As abas filtram por tipo e mostram os contadores:** Todas 2, Menções 1, Mensagens diretas 1;
   cada aba muda a URL e a lista.
5. **Cada aba vazia mostra o seu vazio.**
6. **A falha ao carregar mais mostra o erro com Tentar de novo:** a rota do BFF interceptada com
   502; "Tentar de novo" carrega a página que faltava.
7. **Tudo pelo teclado:** das abas aos itens, e Enter abre a Conversa.

Acessibilidade (`acessibilidade/atividade-sem-violacoes.spec.ts`): a tela Atividade com um item
lido e um não lido, sem violações do axe.

## F08-T02 · Abrir a Conversa na Mensagem (`atividade/abrir-na-mensagem.spec.ts`)

1. **Vai até a Mensagem fora da primeira página e a destaca:** 160 Mensagens; `?mensagem=` da
   Mensagem 10 mostra "Indo até a mensagem…", chega a ela com o destaque, que some em 2 s.
2. **A URL perde o parâmetro e recarregar não vai de novo:** depois da ida, a URL fica sem
   `mensagem`, e recarregar abre no fim.
3. **A Mensagem apagada mostra que não está mais disponível.**
4. **Abrir na Mensagem lê a Conversa:** a Menção não lida some da barra lateral.
5. **A Mensagem pedida vence a primeira Não lida, com o divisor no lugar.**
6. **O item de Atividade leva à Mensagem:** Enter no item abre a Conversa na Mensagem, destacada.

## F08-T03 · Atividade em tempo real (`atividade/tempo-real.spec.ts`)

A outra Pessoa envia e apaga pela API do chat (`support/chat-api.ts`), com o cookie da página dela.

1. **A Notificação entra na Atividade e no rail das duas abas:** uma Menção e uma Mensagem direta
   entram no topo da Atividade, e o rail das duas abas passa a "Atividade, 2 não lidas".
2. **A Mensagem apagada sai da Atividade:** e o rail volta a "Atividade".
3. **Ler a Conversa deixa o item lido e baixa o número nas duas abas.**
4. **A queda de conexão termina com os números certos:** a Menção que chegou sem rede conta no rail
   ao reconectar.

## F08-T04 · Marcar tudo como lido (`atividade/marcar-tudo.spec.ts`)

1. **O botão fica desabilitado sem não lidas.**
2. **A falha mostra o toast de erro:** a rota do BFF interceptada com 502 e meio segundo de espera;
   o botão fica ocupado enquanto espera e volta a ficar habilitado depois do toast.
3. **Marcar tudo zera o rail nas duas abas e mantém o negrito da barra lateral:** o item fica lido,
   o botão fica desabilitado, e o Canal da Menção continua em negrito, com o contador.

## F08-T05 · Alerta na tela (`atividade/alerta.spec.ts`)

1. **A Menção e a Mensagem direta alertam na aba em foco:** com o título, o começo do texto e
   "Abrir".
2. **O Alerta fica acima do campo de envio e fecha:** o fundo dele fica acima do topo do campo, que
   continua clicável; o botão de fechar o tira.
3. **O Alerta não tira o foco e é alcançável pelo teclado:** a caixa de mensagem continua em foco, a
   região é `aria-live` educada, e Alt+T e Tab chegam ao Alerta.
4. **Abrir leva à Mensagem e baixa o rail** nas duas abas.
5. **Só a aba em foco alerta:** a outra, sem foco, só conta no rail.
6. **A Conversa aberta em foco não alerta.**
7. **O que chegou durante a queda não alerta:** conta no rail ao reconectar.

Acessibilidade (`acessibilidade/alerta-sem-violacoes.spec.ts`): a tela com o Alerta, sem violações.

## F08-T06 · Notificação do navegador (`atividade/notificacao-do-navegador.spec.ts`)

A Notification do navegador é trocada por uma instrumentada (`support/browser-notifications.ts`),
que guarda o que foi criado, responde a permissão pedida pelo teste e deixa clicar; o foco das abas
é controlado por `support/tab-focus.ts`.

1. **Ativar pede a permissão e liga a opção:** com a permissão `default` e a resposta `granted`, o
   item passa a "Desativar" e continua assim depois de recarregar.
2. **Desativar desliga a opção.**
3. **Com a permissão negada, a opção fica bloqueada:** "Bloqueadas neste navegador", desabilitado.
4. **Sem aba em foco sai uma notificação só:** as duas abas criam a notificação com o mesmo `tag`,
   o id da Mensagem, que o navegador junta numa só.
5. **Com uma aba em foco não sai notificação:** a aba em foco mostra o Alerta.
6. **O clique abre a Mensagem.**
