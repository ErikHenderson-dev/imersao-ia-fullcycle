import type { QuotePayload } from 'chat-events';
import { MessageView } from './messages.service';

export interface MessageResponse {
  id: string;
  conversation_id: string;
  client_id: string;
  author: { id: string; name: string };
  body: string;
  created_at: string;
  edited_at: string | null;
  mentions: { id: string; username: string }[];
  quote: QuotePayload | null;
}

export function toMessageResponse(message: MessageView): MessageResponse {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    client_id: message.clientId,
    author: message.author,
    body: message.body,
    created_at: message.createdAt.toISOString(),
    edited_at: message.editedAt?.toISOString() ?? null,
    mentions: message.mentions,
    quote: message.quote,
  };
}
