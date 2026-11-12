import type { TaskPayload } from 'chat-events';
import type { TaskNotification } from './task-notification.entity';
import type { TaskView } from './tasks.service';

// A Tarefa no payload, a mesma das rotas e dos eventos (spec da F12, "Concluir, reabrir e listar").
export type TaskResponse = TaskPayload;

export function toTaskResponse(task: TaskView): TaskResponse {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    created_at: task.createdAt.toISOString(),
    completed_at: task.completedAt?.toISOString() ?? null,
    assignee: task.assignee,
    delegator: task.delegator,
    conversation: task.conversation,
    trigger_message: task.triggerMessage,
  };
}

// A Notificação na carga do evento de Tarefa de quem recebe: a dele, ou nula (spec da F12, "Eventos").
export function notificationFor(
  notification: Pick<TaskNotification, 'id' | 'kind' | 'recipientId'> | null,
  recipientId: string,
): { id: string; kind: TaskNotification['kind'] } | null {
  return notification?.recipientId === recipientId
    ? { id: notification.id, kind: notification.kind }
    : null;
}
