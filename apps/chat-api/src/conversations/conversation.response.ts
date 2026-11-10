import type { ConversationPayload } from 'chat-events';
import { counterpartOf } from './conversations.service';
import type { ConversationSummary } from './conversations.service';

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
