"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/app/components/ui/button";
import type { Task, TaskRole } from "@/app/services/chat-api";
import { conversationHref, messageHref } from "@/app/utils/conversation-list";
import { cn } from "@/app/utils/cn";
import { taskConversationLabel, taskDate } from "@/app/utils/tasks";

type TaskItemProps = {
  task: Task;
  role: TaskRole;
  timeZone: string;
  // Aberta pelo link com a Tarefa (`?tarefa=`): recebe o foco e o destaque.
  highlighted: boolean;
  // A mudança de estado em andamento: o botão mostra o spinner.
  updating: boolean;
  onChangeStatus: (task: Task) => void;
};

// Uma Tarefa da aba Tarefas (TaskItem, design system): o título, quem delegou ou o Responsável, a
// Conversa, a data, o estado e o link para o Pedido. Nas Recebidas, Concluir ou Reabrir; nas
// Delegadas, só o estado (spec da F12, "Cliente (web)").
export function TaskItem({ task, role, timeZone, highlighted, updating, onChangeStatus }: TaskItemProps) {
  const isDone = task.status === "done";
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlighted) return;
    ref.current?.scrollIntoView({ block: "center" });
    ref.current?.focus();
  }, [highlighted]);
  const person = role === "assigned" ? `Delegada por ${task.delegator.name}` : `Responsável: ${task.assignee.name}`;
  return (
    <li>
      <div
        ref={ref}
        tabIndex={highlighted ? -1 : undefined}
        data-highlighted={highlighted || undefined}
        className={cn(
          "flex items-start gap-3 border-b border-border-subtle px-5 py-3",
          highlighted && "border-l-4 border-l-highlight-border bg-highlight-bg",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-body font-bold", isDone ? "text-fg-muted" : "text-fg")}>
              {task.title}
            </span>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-pill bg-surface-inset px-2 text-caption font-bold",
                isDone ? "text-success" : "text-fg-muted",
              )}
            >
              {isDone && <Check size={12} aria-hidden />}
              {isDone ? "Concluída" : "Aberta"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-small text-fg-muted">
            <span>{person}</span>
            <span aria-hidden>·</span>
            {task.triggerMessage.deleted ? (
              <Link href={conversationHref(task.conversation)} className="hover:text-link-hover hover:underline">
                {taskConversationLabel(task)}
              </Link>
            ) : (
              <span>{taskConversationLabel(task)}</span>
            )}
            <span aria-hidden>·</span>
            <span suppressHydrationWarning>{taskDate(task.createdAt, timeZone)}</span>
            <span aria-hidden>·</span>
            {task.triggerMessage.deleted ? (
              <span className="italic">Mensagem apagada</span>
            ) : (
              <Link
                href={messageHref(task.conversation.id, task.triggerMessage.id)}
                className="text-link hover:text-link-hover hover:underline"
              >
                Ver Pedido
              </Link>
            )}
          </div>
        </div>
        {role === "assigned" && (
          <Button variant="secondary" size="sm" loading={updating} onClick={() => onChangeStatus(task)}>
            {isDone ? "Reabrir" : "Concluir"}
          </Button>
        )}
      </div>
    </li>
  );
}
