import type { TaskView } from './tasks.service';

// A Tarefa no payload (spec da F12, "Concluir, reabrir e listar").
export interface TaskResponse {
  id: string;
  title: string;
  status: TaskView['status'];
  created_at: string;
  completed_at: string | null;
  assignee: TaskView['assignee'];
  delegator: TaskView['delegator'];
  conversation: TaskView['conversation'];
  trigger_message: TaskView['triggerMessage'];
}

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
