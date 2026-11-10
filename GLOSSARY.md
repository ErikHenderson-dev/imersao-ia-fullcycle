# Full Cycle Chat

Chat de equipe no estilo Slack em que agentes de IA entram como plugins. Este glossário guarda o
vocabulário do produto; os termos do processo de desenvolvimento ficam no `AGENTS.md`, seção
"Planejamento".

## Language

**Pessoa**:
Quem tem conta no workspace, criada pela empresa, e entra no chat com o próprio e-mail e senha.
_Avoid_: usuário, conta, membro

**@usuário**:
O nome único de uma Pessoa no workspace, que não muda, usado para encontrá-la e mencioná-la.
_Avoid_: handle, apelido, login

**Perfil**:
O que o workspace vê de uma Pessoa: nome, cargo, @usuário, contato e hora local.
_Avoid_: conta

**Membro**:
Uma Pessoa enquanto participante de uma Conversa, seja Canal ou Conversa direta. Fora de uma
Conversa, é só Pessoa.
_Avoid_: participante

**Conversa**:
Onde as Mensagens acontecem: um Canal ou uma Conversa direta.
_Avoid_: chat, sala

**Canal**:
Conversa com nome e Tópico, pública, com todo o workspace como Membro, ou privada, só com quem a
criou e quem um Membro adicionou a ela. Adicionar ao Canal torna a Pessoa Membro na hora, sem
aceite.
_Avoid_: grupo; convidar ou convite, para adicionar ao Canal

**Convite**:
O chamado, por e-mail, para quem ainda não tem conta criar a própria e entrar no workspace.
_Avoid_: convite para Canal

**Conversa direta**:
Conversa sem nome entre duas Pessoas, ou de uma Pessoa consigo mesma.
_Avoid_: DM, exceto como rótulo da aba em Atividade

**Tópico**:
A frase que descreve um Canal, mostrada no cabeçalho dele.
_Avoid_: descrição

**Mensagem**:
Texto que uma Pessoa ou um agente envia numa Conversa.

**Menção**:
O `@usuário` de um Membro escrito numa Mensagem, que chama a atenção dele para ela.
_Avoid_: marcação, tag

**Citação**:
A referência, numa Mensagem, a outra Mensagem da mesma Conversa a que ela responde.
_Avoid_: resposta, reply (ficam para a thread)

**Última leitura**:
Até que Mensagem uma Pessoa leu uma Conversa. Avança quando ela abre a Conversa com a aba do
navegador em foco, e nunca volta.
_Avoid_: visto, lida por

**Não lida**:
Mensagem de outro autor, numa Conversa de que a Pessoa é Membro, que chegou depois da Última
leitura dela.
_Avoid_: nova, como sinônimo

**Notificação**:
O aviso a uma Pessoa de uma Menção a ela, ou de uma Mensagem de outro autor numa Conversa direta
com ela. Fica lida quando ela lê a Conversa até aquela Mensagem ou marca tudo como lido.
_Avoid_: alerta, aviso

**Atividade**:
A tela que reúne as Notificações de uma Pessoa.
_Avoid_: caixa de entrada, inbox

**Alerta**:
Uma Notificação mostrada na tela do chat no momento em que chega.
_Avoid_: toast, pop-up

**Sessão**:
O acesso de uma Pessoa ao chat num navegador, do momento em que ela entra até sair, a Sessão
vencer por falta de uso ou ser revogada. Vale para todas as abas daquele navegador.
_Avoid_: login (como substantivo), token

**Tarefa**:
Um trabalho que um agente delega a uma pessoa mencionada, a pedido de quem o mencionou; fica com
essa pessoa como responsável até ela concluí-lo, e pode ser reaberto. Não é a tarefa do
planejamento (`F01-T02`), definida no `AGENTS.md`.
_Avoid_: to-do, pendência
