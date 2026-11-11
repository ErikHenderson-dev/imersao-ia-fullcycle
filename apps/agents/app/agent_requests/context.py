"""As chaves do contexto do Pedido no estado da sessão do ADK (spec da F11, "Execução do Pedido").

Entram pelo `state_delta` do Runner, e as ferramentas as leem pelo `ToolContext`. Nenhuma instrução
as injeta, então o modelo não as vê nem consegue trocar de Conversa ou de Pedido.
"""

REQUEST_ID = "request_id"
CONVERSATION_ID = "conversation_id"
REQUESTER_ID = "requester_id"
REQUESTER_NAME = "requester_name"
REQUESTER_USERNAME = "requester_username"
TIME_ZONE = "time_zone"
