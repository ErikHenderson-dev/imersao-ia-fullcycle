import { ListChecks } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { TasksEmptyRefresh } from "./tasks-empty-refresh";
import type { Task, TaskPage } from "@/app/services/chat-api";
import { taskRoles } from "@/app/utils/tasks";
import { TaskGroup } from "./task-group";

type TaskBoardProps = {
  personId: string;
  assigned: TaskPage;
  delegated: TaskPage;
  timeZone: string;
  highlightedId: string | null;
  // A Tarefa do link, lida pelo servidor quando não está na primeira página do grupo dela.
  highlighted: Task | null;
};

// A aba Tarefas (spec da F12, "Cliente (web)"): Recebidas e Delegadas, cada uma com as abertas
// primeiro. Sem nenhuma Tarefa, o vazio explica como pedir uma ao Agente.
export function TaskBoard({ personId, assigned, delegated, timeZone, highlightedId, highlighted }: TaskBoardProps) {
  const pinnedFor = (role: "assigned" | "delegated", page: TaskPage) =>
    highlighted && taskRoles(highlighted, personId).includes(role) && !page.tasks.some((t) => t.id === highlighted.id)
      ? highlighted
      : null;
  if (assigned.tasks.length === 0 && delegated.tasks.length === 0 && !highlightedId) {
    return (
      <div className="flex justify-center">
        <EmptyState
          icon={ListChecks}
          title="Nenhuma Tarefa"
          description="Mencione o @assistente numa Conversa e peça para delegar uma Tarefa a alguém."
        />
        <TasksEmptyRefresh />
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <TaskGroup
        personId={personId}
        role="assigned"
        initialPage={assigned}
        timeZone={timeZone}
        highlightedId={highlightedId}
        initialPinned={pinnedFor("assigned", assigned)}
      />
      <TaskGroup
        personId={personId}
        role="delegated"
        initialPage={delegated}
        timeZone={timeZone}
        highlightedId={highlightedId}
        initialPinned={pinnedFor("delegated", delegated)}
      />
    </div>
  );
}
