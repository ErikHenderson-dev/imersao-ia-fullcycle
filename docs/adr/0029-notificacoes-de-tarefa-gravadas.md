---
status: aceita
---

# 0029 · Notificações de Tarefa gravadas, como mais uma fonte da consulta de Atividade

A Notificação de Tarefa (recebida, concluída ou reaberta) é gravada numa linha por destinatário, na
mesma transação que cria, conclui ou reabre a Tarefa. Ela entra como mais uma fonte da consulta de
Atividade da [ADR 0027](0027-notificacoes-calculadas.md), ao lado das Menções e das Conversas
diretas. Está lida quando a linha tem a marca de leitura, gravada quando a Pessoa a abre, ou quando
é igual ou anterior à marca "Atividade lida até". Ela não nasce de uma Mensagem, então não há
Menção nem Última leitura de onde calculá-la, e o PRD da F12 manda que fique lida ao ser aberta, e
não ao ler a Conversa. Conclusão e reabertura são fatos que acontecem num instante, e cada um gera
uma Notificação, que precisa existir mesmo depois de a Tarefa mudar de novo.

Descartadas: calcular a Notificação a partir do estado atual da Tarefa, que perde as conclusões e
reaberturas intermediárias e não tem onde guardar a leitura; e uma tabela de Notificações para
todos os tipos, que desfaria a ADR 0027 para as Menções e as Conversas diretas.

Custo aceito: a Atividade passa a ter duas regras de leitura. A de Menção e de Conversa direta é
calculada; a de Tarefa é gravada. Como a Tarefa não se edita nem se apaga, as linhas não precisam
de correção depois de gravadas.
