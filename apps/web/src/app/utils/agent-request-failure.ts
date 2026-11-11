import type { StartAgentRequestResult } from "@/app/services/agents-service";

// Por que o Agente não recebeu o Pedido, no aviso ao lado da Mensagem (LLD, "Erros").
export type AgentErrorReason = "unavailable" | "rate_limited";

export type AgentRequestFailure = { close: "failed" | "cancelled"; reason: AgentErrorReason | null };

// O que o BFF faz quando o Serviço de agentes não aceita o Pedido (spec da F11, "Disparo pelo BFF"):
// o Agente desconectado (409) encerra como cancelled, sem erro, porque a Menção é texto comum; o
// limite (429), como failed, com o erro de limite; o resto (rede fora, tempo esgotado, outro status),
// como failed, com o Agente sem receber o Pedido.
export function agentRequestFailure(result: StartAgentRequestResult): AgentRequestFailure | null {
  if (result.kind === "accepted") return null;
  if (result.status === 409) return { close: "cancelled", reason: null };
  return { close: "failed", reason: result.status === 429 ? "rate_limited" : "unavailable" };
}
