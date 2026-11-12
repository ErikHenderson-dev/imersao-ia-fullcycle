"use client";

import { useRouter } from "next/navigation";
import { useKnownPerson } from "@/app/components/people/people-provider";
import { PersonAvatar } from "@/app/components/people/person-display";
import type { TaskActivityItem } from "@/app/services/chat-api";
import { markTaskNotificationOpened } from "@/app/services/task-notifications";
import { notificationSuffix, taskHref, taskNotificationTitle } from "@/app/utils/activity";
import { cn } from "@/app/utils/cn";
import { initials } from "@/app/utils/initials";

type TaskNotificationItemProps = {
  item: TaskActivityItem;
  isRead: boolean;
  time: string;
  // Avisa a lista de que a Notificação foi aberta.
  onOpen: () => void;
};

// A Notificação de Tarefa em Atividade (NotificationItem, design system): quem agiu, o que fez e o
// título da Tarefa. É um link para a aba Tarefas com a Tarefa em destaque, e abrir a deixa lida
// (spec da F12, "Cliente (web)").
export function TaskNotificationItem({ item, isRead, time, onOpen }: TaskNotificationItemProps) {
  const router = useRouter();
  const actorName = useKnownPerson(item.actor.id)?.name ?? item.actor.name;
  const href = taskHref(item.task.id);
  return (
    <li>
      <a
        href={href}
        data-read={isRead}
        onClick={(event) => {
          void markTaskNotificationOpened(item.notification.id);
          onOpen();
          // Com Ctrl, Cmd, Shift ou outro botão, o navegador abre o link noutra aba.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          router.push(href);
        }}
        onAuxClick={() => {
          void markTaskNotificationOpened(item.notification.id);
          onOpen();
        }}
        className={cn(
          "flex items-start gap-3 border-b border-border-subtle px-5 py-3 hover:bg-surface-subtle",
          !isRead && "bg-highlight-bg hover:bg-highlight-bg",
        )}
      >
        <PersonAvatar person={{ id: item.actor.id, initials: initials(actorName) }} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-3">
            <span className={cn("min-w-0 flex-1 truncate text-body text-fg", !isRead && "font-bold")}>
              {taskNotificationTitle(item.notification.kind, actorName)}
            </span>
            <span className="shrink-0 text-caption text-fg-muted" suppressHydrationWarning>
              {time}
            </span>
          </span>
          <span className="truncate text-body text-fg-muted">{item.task.title}</span>
          <span className="sr-only">{notificationSuffix(isRead)}</span>
        </span>
        <span className="flex w-2 shrink-0 pt-2">
          {!isRead && <span className="size-2 rounded-pill bg-badge" />}
        </span>
      </a>
    </li>
  );
}
