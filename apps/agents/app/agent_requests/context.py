"""As chaves do contexto do Pedido no estado da sessão do ADK (spec da F11, "Execução do Pedido").

Entram pelo `state_delta` do Runner, e as ferramentas as leem pelo `ToolContext`. Só `MENTIONS`
chega ao modelo, pelas instruções do Agente; o resto ele não vê, então não consegue trocar de
Conversa nem de Pedido.
"""

REQUEST_ID = "request_id"
CONVERSATION_ID = "conversation_id"
REQUESTER_ID = "requester_id"
REQUESTER_NAME = "requester_name"
REQUESTER_USERNAME = "requester_username"
TIME_ZONE = "time_zone"
# O instante da Mensagem do Pedido, em ISO UTC: o Recorte é calculado contra ele (F11-T04).
REQUESTED_AT = "requested_at"
# As Pessoas mencionadas no pedido, `[{username, name}]`, para o modelo citar pelo nome.
MENTIONS = "mentions"
# `new` ou `continuation`: a continuação não pergunta de novo (F11-T07).
KIND = "kind"
# O Pedido que gravou a pergunta com as Respostas prontas: ele termina sem `reply` (F11-T07).
QUESTION_FOR = "pergunta_do_pedido"
# O Pedido que delegou a Tarefa, com a confirmação já gravada: ele termina sem `reply` (F12-T01).
TASK_FOR = "tarefa_do_pedido"
