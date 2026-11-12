import type { Task, TaskPage, TaskRole } from "@/app/services/chat-api";
import { redirectToExpiredSession } from "@/app/utils/return-path";

// A chave de uma página de um grupo: a Pessoa, o grupo e o cursor (nulo na primeira).
export type TaskPageKey = [string, string, TaskRole, string | null];

// Uma página de Tarefas pela rota do BFF, no cliente (spec da F12, "Cliente (web)").
export async function fetchTaskPage([, , role, cursor]: TaskPageKey): Promise<TaskPage> {
  const params = new URLSearchParams({ role });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/tasks?${params.toString()}`);
  if (response.status === 401) return redirectToExpiredSession();
  if (!response.ok) throw new Error("Não foi possível carregar suas Tarefas.");
  return (await response.json()) as TaskPage;
}

// Conclui ou reabre a Tarefa; devolve a Tarefa como ficou.
export async function postTaskStatus(taskId: string, action: "complete" | "reopen"): Promise<Task> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/${action}`, { method: "POST" });
  if (response.status === 401) return redirectToExpiredSession();
  if (!response.ok) throw new Error("Não foi possível mudar a Tarefa.");
  return (await response.json()) as Task;
}
