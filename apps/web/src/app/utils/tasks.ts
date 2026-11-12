import type { TaskPayload } from "chat-events";
import type { Task, TaskPage, TaskRole } from "@/app/services/chat-api";
import { cachedFormatter } from "./date-formatters";

// A Tarefa da API e dos eventos no formato da web (spec da F12, "Concluir, reabrir e listar").
export function taskFromPayload(payload: TaskPayload): Task {
  return {
    id: payload.id,
    title: payload.title,
    status: payload.status,
    createdAt: payload.created_at,
    completedAt: payload.completed_at,
    assignee: payload.assignee,
    delegator: payload.delegator,
    conversation: payload.conversation,
    triggerMessage: payload.trigger_message,
  };
}

// Os grupos da aba Tarefas em que a Tarefa entra para a Pessoa: Recebidas, Delegadas ou os dois,
// quando ela delegou a si mesma.
export function taskRoles(task: Task, personId: string): TaskRole[] {
  const roles: TaskRole[] = [];
  if (task.assignee.id === personId) roles.push("assigned");
  if (task.delegator.id === personId) roles.push("delegated");
  return roles;
}

// A ordem dos grupos, a mesma da API: as abertas antes das concluídas e, em cada estado, as mais
// novas primeiro (os ids são UUID v7, comparados como texto).
function compareTasks(a: Task, b: Task): number {
  const byStatus = Number(a.status === "done") - Number(b.status === "done");
  if (byStatus !== 0) return byStatus;
  return a.id === b.id ? 0 : a.id > b.id ? -1 : 1;
}

// As páginas de um grupo com a Tarefa nova ou mudada no lugar dela, sem buscar nada: ela sai de onde
// estava e entra na página em que cai pela ordem, ou fica de fora se cai depois do que já foi
// carregado e ainda há mais páginas. Uma Tarefa que não é do grupo só sai.
export function mergeTask(pages: TaskPage[], task: Task, role: TaskRole, personId: string): TaskPage[] {
  const without = pages.map((page) => ({ ...page, tasks: page.tasks.filter((entry) => entry.id !== task.id) }));
  if (!taskRoles(task, personId).includes(role) || without.length === 0) return without;
  const index = without.findIndex((page) => {
    const last = page.tasks.at(-1);
    return last !== undefined && compareTasks(task, last) < 0;
  });
  const target = index === -1 ? without.length - 1 : index;
  if (index === -1 && without[target].nextCursor !== null) return without;
  return without.map((page, position) =>
    position === target ? { ...page, tasks: [...page.tasks, task].sort(compareTasks) } : page,
  );
}

// Onde a Tarefa foi pedida: "#geral" num Canal, "Conversa direta" na Conversa direta.
export function taskConversationLabel(task: Pick<Task, "conversation">): string {
  return task.conversation.name ? `#${task.conversation.name}` : "Conversa direta";
}

// A data da Tarefa, como "10 nov", no fuso de quem vê.
export function taskDate(isoDate: string, timeZone: string): string {
  return cachedFormatter(`day-month:${timeZone}`, () =>
    new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone }),
  )
    .format(new Date(isoDate))
    .replace(" de ", " ")
    .replace(".", "");
}

// Concluir a aberta, reabrir a concluída: a Tarefa como fica, para a atualização otimista.
export function toggledTask(task: Task): { action: "complete" | "reopen"; next: Task } {
  return task.status === "open"
    ? { action: "complete", next: { ...task, status: "done", completedAt: new Date().toISOString() } }
    : { action: "reopen", next: { ...task, status: "open", completedAt: null } };
}

// As páginas com a Tarefa trocada no lugar, sem mudar a ordem: a atualização otimista e a volta dela
// não tiram da lista a Tarefa que, pela ordem, cairia depois das páginas carregadas.
export function replaceTask(pages: TaskPage[], task: Task): TaskPage[] {
  return pages.map((page) => ({
    ...page,
    tasks: page.tasks.map((entry) => (entry.id === task.id ? task : entry)),
  }));
}
