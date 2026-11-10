import type { ConversationPayload } from 'chat-events';
import { counterpartOf } from './conversations.service';
import type {
  ConversationSummary,
  ListedConversation,
} from './conversations.service';

// A Conversa do REST é a mesma do evento do tempo real (pacote chat-events), montada para quem a
// recebe: a outra Pessoa da Conversa direta depende de quem vê (spec da F05, "Conversa direta").
export type ConversationResponse = ConversationPayload;

export function toConversationResponse(
  summary: ConversationSummary,
  viewerId: string,
): ConversationResponse {
  const { conversation, memberCount } = summary;
  return {
    id: conversation.id,
    kind: conversation.kind,
    name: conversation.name,
    topic: conversation.topic,
    member_count: memberCount,
    counterpart: counterpartOf(summary, viewerId),
  };
}

// A Conversa da lista de quem é Membro: a do evento mais a Última leitura e os números (spec da
// F07, "Rotas"). Só a lista os traz; o evento e a Conversa sozinha não.
export type ListedConversationResponse = ConversationResponse & {
  last_read_message_id: string | null;
  unread_count: number;
  mention_count: number;
};

export function toListedConversationResponse(
  listed: ListedConversation,
  viewerId: string,
): ListedConversationResponse {
  return {
    ...toConversationResponse(listed, viewerId),
    last_read_message_id: listed.unread.lastReadMessageId,
    unread_count: listed.unread.unreadCount,
    mention_count: listed.unread.mentionCount,
  };
}
