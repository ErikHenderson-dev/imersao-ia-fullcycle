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
