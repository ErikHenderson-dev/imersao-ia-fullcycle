import type { MessagePayload } from "chat-events";
import type { Message } from "@/app/services/chat-api";
import { initials } from "./initials";

// A Mensagem de um evento do tempo real no formato da web, como o service do BFF a monta. Um evento
// reenviado pela reconexão pode ter sido gravado antes de a Mensagem ganhar a edição, as Menções e
// a Citação (F06): os campos que faltam viram os valores vazios.
export function messageFromEvent(payload: MessagePayload): Message {
  return {
    id: payload.id,
    conversationId: payload.conversation_id,
    clientId: payload.client_id,
    // O evento guardado antes da F11 traz só o id e o nome: o autor era sempre uma Pessoa.
    author: {
      ...payload.author,
      kind: payload.author.kind ?? "person",
      username: payload.author.username ?? "",
      initials: initials(payload.author.name),
    },
    body: payload.body,
    createdAt: payload.created_at,
    editedAt: payload.edited_at ?? null,
    mentions: payload.mentions ?? [],
    quote: payload.quote ?? null,
    // O evento guardado antes da F11-T07 não traz as Respostas prontas.
    quickReplies: payload.quick_replies
      ? {
          options: payload.quick_replies.options,
          ownerId: payload.quick_replies.owner_id,
          expiresAt: payload.quick_replies.expires_at,
          closed: payload.quick_replies.closed,
        }
      : null,
    // O evento guardado antes da F13 não traz a marca.
    businessData: payload.business_data ?? false,
    blocked: payload.blocked ?? false,
  };
}
