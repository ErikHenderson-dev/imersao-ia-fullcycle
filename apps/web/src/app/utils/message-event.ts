import type { MessagePayload } from "chat-events";
import type { Message } from "@/app/services/chat-api";
import { initials } from "./initials";

// A Mensagem de um evento do tempo real no formato da web, como o service do BFF a monta. Um evento
// reenviado pela reconexão pode ter sido gravado antes de a Mensagem ganhar a edição e as Menções
// (F06): os campos que faltam viram os valores vazios.
export function messageFromEvent(payload: MessagePayload): Message {
  return {
    id: payload.id,
    conversationId: payload.conversation_id,
    clientId: payload.client_id,
    author: { ...payload.author, initials: initials(payload.author.name) },
    body: payload.body,
    createdAt: payload.created_at,
    editedAt: payload.edited_at ?? null,
    mentions: payload.mentions ?? [],
  };
}
