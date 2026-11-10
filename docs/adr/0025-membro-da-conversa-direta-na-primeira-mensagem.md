---
status: aceita
---

# 0025 · Na Conversa direta, a outra Pessoa vira Membro na primeira Mensagem

Abrir uma Conversa direta grava só a participação de quem a abriu. A outra Pessoa vira Membro na
transação da primeira Mensagem, ou antes, se ela mesma abrir a Conversa direta. A unicidade do par
fica na própria Conversa, e não na participação. Assim, a regra do PRD da F05 (a Conversa direta
aparece para a outra Pessoa só quando chega a primeira Mensagem) sai da própria participação: a
lista de Conversas, a conferência de acesso e o "digitando" não mudam, e a entrada na barra lateral
é o mesmo `conversation.member_added` da F04.

Descartadas: gravar as duas participações na abertura e esconder da lista a Conversa direta sem
Mensagens, o que obrigaria a lista, o tempo real e o "digitando" a conhecer uma exceção; e uma marca
de "visível na barra lateral" em cada participação, que duplicaria o que a participação já diz.

Custo aceito: antes da primeira Mensagem, a outra Pessoa não é Membro e recebe "Conversa não
encontrada" pelo endereço, e o envio de Mensagem numa Conversa direta passa a poder gravar uma
participação.
