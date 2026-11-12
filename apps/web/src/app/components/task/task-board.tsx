import { ListChecks } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { TaskPage } from "@/app/services/chat-api";
import { TaskGroup } from "./task-group";

type TaskBoardProps = {
  personId: string;
  assigned: TaskPage;
  delegated: TaskPage;
  timeZone: string;
  highlightedId: string | null;
};

// A aba Tarefas (spec da F12, "Cliente (web)"): Recebidas e Delegadas, cada uma com as abertas
// primeiro. Sem nenhuma Tarefa, o vazio explica como pedir uma ao Agente.
export function TaskBoard({ personId, assigned, delegated, timeZone, highlightedId }: TaskBoardProps) {
  if (assigned.tasks.length === 0 && delegated.tasks.length === 0 && !highlightedId) {
    return (
      <div className="flex justify-center">
        <EmptyState
          icon={ListChecks}
          title="Nenhuma Tarefa"
          description="Mencione o @assistente numa Conversa e peça para delegar uma Tarefa a alguém."
        />
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
      />
      <TaskGroup
        personId={personId}
        role="delegated"
        initialPage={delegated}
        timeZone={timeZone}
        highlightedId={highlightedId}
      />
    </div>
  );
}
