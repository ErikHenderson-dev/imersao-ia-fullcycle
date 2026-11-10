import type { ConversationPayload } from "chat-events";
import type { Conversation } from "@/app/services/chat-api";
import { initials } from "./initials";

// A Conversa da API, no REST ou num evento do tempo real, no formato da web.
export function conversationFromPayload(payload: ConversationPayload): Conversation {
  const { counterpart } = payload;
  return {
    id: payload.id,
    kind: payload.kind,
    name: payload.name ?? "",
    topic: payload.topic,
    memberCount: payload.member_count,
    counterpart: counterpart ? { ...counterpart, initials: initials(counterpart.name) } : null,
  };
}
