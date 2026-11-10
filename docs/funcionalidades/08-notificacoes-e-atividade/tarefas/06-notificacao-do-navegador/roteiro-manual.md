# Roteiro manual da F08-T06

Feito por uma pessoa, no Chrome da máquina, com o ambiente de pé (`AGENTS.md`, "Subir e derrubar")
e duas contas: a que recebe e a que menciona, em outro navegador ou numa janela anônima.

## A notificação de verdade

1. Entrar com a conta que recebe, abrir o menu do avatar e escolher "Ativar notificações do
   navegador"; aceitar o pedido do Chrome.
2. Abrir uma segunda aba do chat com a mesma conta.
3. Trocar para outro aplicativo, deixando o Chrome sem foco.
4. Com a outra conta, mencionar a primeira num Canal.
5. Conferir: aparece **uma** notificação do sistema, com "<autor> mencionou você em #<canal>" e o
   começo do texto.
6. Clicar na notificação. Conferir: o Chrome vem para a frente, numa aba do chat, com a Conversa
   aberta na Mensagem, destacada.
7. Voltar ao menu e escolher "Desativar notificações do navegador"; repetir os passos 3 e 4 e
   conferir que nenhuma notificação aparece.

| Data | Quem | Resultado | Observações |
| --- | --- | --- | --- |
| A preencher | | | |

Os testes do Playwright (`e2e/atividade/notificacao-do-navegador.spec.ts`) cobrem o mesmo fluxo com
uma Notification instrumentada; o que só a pessoa confere é a notificação do sistema e o clique
trazendo a janela para a frente.
