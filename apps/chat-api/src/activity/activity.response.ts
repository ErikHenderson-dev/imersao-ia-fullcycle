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
import type { TaskNotificationKind } from 'chat-events';
import { type TaskResponse, toTaskResponse } from '../tasks/task.response';
import type { TaskPerson } from '../tasks/tasks.service';
import type { ActivityItem } from './activity.service';

// Um item de Atividade no REST (spec da F08, "Rotas"): a Mensagem como no histórico e a Conversa
// como no evento.
// O item de Tarefa traz a Notificação, a Tarefa e quem agiu (spec da F12, "Atividade").
export type ActivityItemResponse =
  | {
      kind: Exclude<NotificationKind, 'task'>;
      message: MessageResponse;
      conversation: ConversationResponse;
    }
  | {
      kind: 'task';
      notification: { id: string; kind: TaskNotificationKind; read: boolean };
      task: TaskResponse;
      actor: TaskPerson;
    };

export interface ActivityUnreadResponse {
  activity_read_message_id: string | null;
  total_count: number;
  mention_count: number;
  direct_count: number;
  task_count: number;
}

export function toActivityItemResponse(
  item: ActivityItem,
  viewerId: string,
): ActivityItemResponse {
  if (item.kind === 'task') {
    return {
      kind: 'task',
      notification: {
        id: item.notification.id,
        kind: item.notification.kind,
        read: item.notification.isRead,
      },
      task: toTaskResponse(item.task),
      actor: item.actor,
    };
  }
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
    activity_read_message_id: counts.activityReadMessageId,
    total_count: counts.totalCount,
    mention_count: counts.mentionCount,
    direct_count: counts.directCount,
    task_count: counts.taskCount,
  };
}
