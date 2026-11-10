---
status: aceita
---

# 0027 · Notificações calculadas a partir das Menções, das Conversas diretas e da Última leitura

As Notificações não são gravadas. As de uma Pessoa saem de uma consulta: as Menções a ela em
Canais de que é Membro, mais as Mensagens de outro autor nas Conversas diretas dela, sem as
apagadas. Uma Notificação está lida quando a Mensagem é igual ou anterior à Última leitura da
Conversa ou à marca "Atividade lida até", a única coisa gravada na Pessoa, que só avança com
"Marcar tudo como lido". O PRD da F08 manda que a exclusão e a edição que muda Menção corrijam as
Notificações e que ler a Conversa leia as Notificações dela. Com a consulta, a correção sai da
própria consulta, e a Notificação não diverge das Menções nem da Última leitura, como os números da
F07 ([ADR 0026](0026-nao-lidas-calculadas-da-ultima-leitura.md)).

Descartadas: uma tabela de Notificações gravada na transação da Mensagem, como o HLD (seção 7)
previa. Ela obrigaria a edição, a exclusão, a remoção de Membro e cada leitura de Conversa a
corrigir linhas Pessoa a Pessoa, e poderia divergir das Menções e da Última leitura.

Custo aceito: a lista e os contadores de Atividade refazem a consulta a cada mudança que afeta a
Pessoa, com a contagem limitada a 100 por tipo. Uma Notificação que não nasce de uma Mensagem, como
a de Tarefa (F12), precisa entrar como mais uma fonte da mesma consulta, ou reabrir esta decisão.
