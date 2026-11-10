import {
  type ConversationResponse,
  toConversationResponse,
} from '../conversations/conversation.response';
import {
  type MessageResponse,
  toMessageResponse,
} from '../messages/message.response';
import type {
  ActivityCounts,
  NotificationKind,
} from '../notifications/notification-finder';
import type { ActivityItem } from './activity.service';

// Um item de Atividade no REST (spec da F08, "Rotas"): a Mensagem como no histórico e a Conversa
// como no evento.
export interface ActivityItemResponse {
  kind: NotificationKind;
  message: MessageResponse;
  conversation: ConversationResponse;
}

export interface ActivityUnreadResponse {
  total_count: number;
  mention_count: number;
  direct_count: number;
}

export function toActivityItemResponse(
  item: ActivityItem,
  viewerId: string,
): ActivityItemResponse {
  return {
    kind: item.kind,
    message: toMessageResponse(item.message),
    conversation: toConversationResponse(item.conversation, viewerId),
  };
}

export function toActivityUnreadResponse(
  counts: ActivityCounts,
): ActivityUnreadResponse {
  return {
    total_count: counts.totalCount,
    mention_count: counts.mentionCount,
    direct_count: counts.directCount,
  };
}
