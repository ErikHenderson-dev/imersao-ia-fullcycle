# Full Cycle Chat

Chat de equipe no estilo Slack em que agentes de IA entram como plugins. Este glossário guarda o
vocabulário do produto; os termos do processo de desenvolvimento ficam no `AGENTS.md`, seção
"Planejamento".

## Language

**Pessoa**:
Quem tem conta no workspace, criada pela empresa, e entra no chat com o próprio e-mail e senha.
_Avoid_: usuário, conta, membro

**Administrador**:
Pessoa com o papel de conectar e desconectar Agentes do workspace. Quem opera a instalação dá e
tira o papel.
_Avoid_: admin, dono

**Permissão de dados**:
O direito de uma Pessoa de pedir consultas aos Dados de negócio e de ver as respostas com eles.
Quem opera a instalação dá e tira; não faz parte do papel de Administrador.
_Avoid_: acesso, papel de dados

**@usuário**:
O nome único de uma Pessoa no workspace, que não muda, usado para encontrá-la e mencioná-la.
_Avoid_: handle, apelido, login

**Perfil**:
O que o workspace vê de uma Pessoa: nome, cargo, @usuário, contato, hora local, Status e
Presença.
_Avoid_: conta

**Status**:
O emoji e a mensagem curta que uma Pessoa mostra no Perfil para dizer o que está fazendo; fica
até ela trocar ou limpar. O andamento do envio de uma Mensagem é o "estado de envio".
_Avoid_: humor, recado

**Presença**:
Se a Pessoa aparece disponível ou ausente para o workspace: disponível só quando ela escolheu
disponível e está com o chat aberto; ausente em qualquer outro caso.
_Avoid_: online, offline, status

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
Texto que uma Pessoa ou um Agente envia numa Conversa.

**Dados de negócio**:
Os dados de vendas da empresa (pedidos, clientes, vendedores, produtos), que os Agentes só leem.
Não são Mensagens nem Pessoas do chat.
_Avoid_: dados da empresa, BI

**Métrica**:
Uma grandeza dos Dados de negócio que um Agente sabe calcular para um período, como faturamento ou
pedidos. Não confundir com as métricas de sucesso do product brief, que medem o produto.
_Avoid_: KPI, indicador

**Resposta bloqueada**:
O aviso que um Membro sem Permissão de dados vê no lugar de uma Mensagem com Dados de negócio.
_Avoid_: mensagem oculta, censurada

**Agente**:
Participante de IA que atende Pedidos feitos por Menção numa Conversa, e as respostas às
Perguntas pendentes dele, e responde nela. Um administrador o conecta ou desconecta do workspace. O
MVP tem um, o @assistente.
_Avoid_: bot (é como ele grava na Conversa, não o que ele é), plugin (metáfora do brief)

**Pedido**:
A Mensagem de uma Pessoa que chama um Agente, por Menção ou como resposta a uma Pergunta pendente,
e o atendimento dela pelo Agente.
_Avoid_: comando, prompt, requisição

**Recorte**:
O subconjunto de Mensagens de uma Conversa que um resumo cobre: por período (hoje, desde ontem, a
semana, tudo), por Pessoa ou por assunto.
_Avoid_: filtro, intervalo

**Pergunta pendente**:
A pergunta de um Agente a quem fez o Pedido, que, enquanto vale, faz a próxima Mensagem dessa
Pessoa naquela Conversa chegar ao Agente sem Menção.
_Avoid_: follow-up

**Resposta pronta**:
O botão de uma Pergunta pendente que, clicado por quem fez o Pedido, vira uma Mensagem dela com o
texto do botão.
_Avoid_: quick reply, sugestão

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
O aviso a uma Pessoa de uma Menção a ela, de uma Mensagem de outro autor numa Conversa direta com
ela, de uma Tarefa que ela recebeu ou da conclusão ou reabertura de uma Tarefa que ela delegou. A
de Menção ou de Conversa direta fica lida quando ela lê a Conversa até aquela Mensagem; a de
Tarefa, quando ela a abre; todas, quando ela marca tudo como lido.
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
Um trabalho que um Agente delega a um Membro da Conversa do Pedido, a pedido de quem o chamou;
fica aberto até o Responsável concluí-lo, e pode ser reaberto. Não é a tarefa do planejamento
(`F01-T02`), definida no `AGENTS.md`.
_Avoid_: to-do, pendência

**Responsável**:
A Pessoa a quem uma Tarefa foi delegada, a única que a conclui e reabre. Quem fez o Pedido é
"quem delegou", sem termo próprio.
_Avoid_: dono, assignee, encarregado
