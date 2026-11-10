import type { ConversationPayload } from "chat-events";
import type { Conversation } from "@/app/services/chat-api";
import { initials } from "./initials";

// A Conversa da lista de Conversas, com a Última leitura e os números (spec da F07, "Rotas").
export type ListedConversationPayload = ConversationPayload & {
  last_read_message_id: string | null;
  unread_count: number;
  mention_count: number;
};

export function listedConversationFromPayload(payload: ListedConversationPayload): Conversation {
  return {
    ...conversationFromPayload(payload),
    lastReadMessageId: payload.last_read_message_id,
    unreadCount: payload.unread_count,
    mentionCount: payload.mention_count,
  };
}

// A Conversa da API, no REST ou num evento do tempo real, no formato da web. Os números só vêm na
// lista: aqui, ela entra com a Última leitura nula e zero.
export function conversationFromPayload(payload: ConversationPayload): Conversation {
  const { counterpart } = payload;
  return {
    id: payload.id,
    kind: payload.kind,
    name: payload.name ?? "",
    topic: payload.topic,
    memberCount: payload.member_count,
    counterpart: counterpart ? { ...counterpart, initials: initials(counterpart.name) } : null,
    lastReadMessageId: null,
    unreadCount: 0,
    mentionCount: 0,
  };
}
