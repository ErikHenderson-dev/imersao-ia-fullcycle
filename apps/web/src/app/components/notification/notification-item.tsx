"use client";

import Link from "next/link";
import { useKnownPerson } from "@/app/components/people/people-provider";
import { PersonAvatar } from "@/app/components/people/person-display";
import type { MessageActivityItem } from "@/app/services/chat-api";
import { notificationSuffix, notificationTitle } from "@/app/utils/activity";
import { messageHref } from "@/app/utils/conversation-list";
import { cn } from "@/app/utils/cn";

type NotificationItemProps = {
  item: MessageActivityItem;
  isRead: boolean;
  // O tempo relativo já formatado, que muda entre o servidor e o cliente no limite de um minuto.
  time: string;
};

// Um item de Atividade (NotificationItem, design system): o autor, onde foi, o começo do texto e o
// tempo; a não lida tem o fundo de destaque, o título em negrito e o ponto `badge`, e o leitor de
// tela ouve "não lida" no fim. É um link, que Enter abre (spec da F08, "Tela Atividade").
export function NotificationItem({ item, isRead, time }: NotificationItemProps) {
  // O nome atual do autor (spec da F09, "Camada de Pessoas").
  const authorName = useKnownPerson(item.message.author.id)?.name ?? item.message.author.name;
  const title = notificationTitle({
    ...item,
    message: { ...item.message, author: { ...item.message.author, name: authorName } },
  });
  return (
    <li>
      <Link
        href={messageHref(item.conversation.id, item.message.id)}
        data-read={isRead}
        className={cn(
          "flex items-start gap-3 border-b border-border-subtle px-5 py-3 hover:bg-surface-subtle",
          !isRead && "bg-highlight-bg hover:bg-highlight-bg",
        )}
      >
        <PersonAvatar person={item.message.author} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-3">
            <span className={cn("min-w-0 flex-1 truncate text-body text-fg", !isRead && "font-bold")}>
              {title}
            </span>
            <span className="shrink-0 text-caption text-fg-muted" suppressHydrationWarning>
              {time}
            </span>
          </span>
          <span className="truncate text-body text-fg-muted">{item.message.body}</span>
          <span className="sr-only">{notificationSuffix(isRead)}</span>
        </span>
        <span className="flex w-2 shrink-0 pt-2">
          {!isRead && <span className="size-2 rounded-pill bg-badge" />}
        </span>
      </Link>
    </li>
  );
}
