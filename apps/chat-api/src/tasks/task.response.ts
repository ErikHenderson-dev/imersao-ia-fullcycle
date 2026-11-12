import type { TaskPayload } from 'chat-events';
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
