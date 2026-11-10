import type { ConversationPayload } from "chat-events";
import type { Conversation } from "@/app/services/chat-api";
import { initials } from "./initials";

// O que só a lista de Conversas traz (spec da F07, "Rotas").
type UnreadPayload = {
  last_read_message_id: string | null;
  unread_count: number;
  mention_count: number;
};

// A Conversa da API, no REST ou num evento do tempo real, no formato da web. Sem os números, que só
// a lista traz, entra com a Última leitura nula e zero.
export function conversationFromPayload(
  payload: ConversationPayload & Partial<UnreadPayload>,
): Conversation {
  const { counterpart } = payload;
  return {
    id: payload.id,
    kind: payload.kind,
    name: payload.name ?? "",
    topic: payload.topic,
    memberCount: payload.member_count,
    counterpart: counterpart ? { ...counterpart, initials: initials(counterpart.name) } : null,
    lastReadMessageId: payload.last_read_message_id ?? null,
    unreadCount: payload.unread_count ?? 0,
    mentionCount: payload.mention_count ?? 0,
  };
}
