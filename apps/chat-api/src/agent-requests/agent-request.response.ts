import type { AgentRequestView } from './agent-requests.service';

// O Pedido na resposta do envio (spec da F11, "Envio e Pergunta pendente").
export interface AgentRequestResponse {
  id: string;
  kind: AgentRequestView['kind'];
  bot_username: string;
  parent_request_id: string | null;
}

export function toAgentRequestResponse(
  request: AgentRequestView,
): AgentRequestResponse {
  return {
    id: request.id,
    kind: request.kind,
    bot_username: request.botUsername,
    parent_request_id: request.parentRequestId,
  };
}
