import type {
  MessageAuthorPayload,
  QuickRepliesPayload,
  QuotePayload,
} from 'chat-events';
import { MessageView } from './messages.service';

export interface MessageResponse {
  id: string;
  conversation_id: string;
  client_id: string;
  author: MessageAuthorPayload;
  body: string;
  created_at: string;
  edited_at: string | null;
  mentions: { id: string; username: string }[];
  quote: QuotePayload | null;
  quick_replies: QuickRepliesPayload | null;
}

export function toMessageResponse(message: MessageView): MessageResponse {
  const { quickReplies } = message;
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
    quick_replies: quickReplies && {
      options: quickReplies.options,
      owner_id: quickReplies.ownerId,
      expires_at: quickReplies.expiresAt.toISOString(),
      closed: quickReplies.closed,
    },
  };
}
