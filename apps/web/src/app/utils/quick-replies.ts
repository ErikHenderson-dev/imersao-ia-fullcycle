import type { QuickReplies } from "@/app/services/chat-api";

// O estado das Respostas prontas de uma pergunta do Agente para quem vê (spec da F11, "Cliente"):
// ativas só para quem pediu enquanto a Pergunta pendente vale; desativadas para os outros Membros;
// e encerradas para todos depois da resposta, de um pedido novo ou do vencimento.
export type QuickRepliesState = "active" | "other_member" | "closed";

export function quickRepliesState(quickReplies: QuickReplies, personId: string, now: Date): QuickRepliesState {
  if (quickReplies.closed || now.getTime() >= Date.parse(quickReplies.expiresAt)) return "closed";
  return quickReplies.ownerId === personId ? "active" : "other_member";
}
