"""As chaves do contexto do Pedido no estado da sessão do ADK (spec da F11, "Execução do Pedido").

Entram pelo `state_delta` do Runner, e as ferramentas as leem pelo `ToolContext`. Só `MENTIONS`
chega ao modelo, pelas instruções do Agente; o resto ele não vê, então não consegue trocar de
Conversa nem de Pedido.
"""

from google.adk.tools import ToolContext

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
# A ferramenta que já gravou o fim do Pedido, `{"pedido": id, "desfecho": "question" | "task"}`:
# a pergunta com as Respostas prontas (F11-T07) ou a Tarefa com a confirmação (F12-T01). O Pedido
# termina sem `reply`.
ANSWERED_BY_TOOL = "respondido_pela_ferramenta"


def mark_answered(tool_context: ToolContext, outcome: str) -> None:
    """Marca que a ferramenta gravou o fim deste Pedido, e não responde com texto: o evento da
    ferramenta vira a resposta final, sem nova chamada ao modelo (`skip_summarization`)."""
    tool_context.state[ANSWERED_BY_TOOL] = {
        "pedido": tool_context.state[REQUEST_ID],
        "desfecho": outcome,
    }
    tool_context.actions.skip_summarization = True
