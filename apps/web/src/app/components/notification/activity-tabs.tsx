"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { CountBadge } from "@/app/components/ui/count-badge";
import { useActivityUnread } from "@/app/hooks/use-activity-unread";
import type { ActivityFilter, ActivityUnread } from "@/app/services/chat-api";
import { ACTIVITY_TABS, activityTabHref, unreadSuffix } from "@/app/utils/activity";
import { activityUnreadKey } from "@/app/utils/activity-cache";
import { cn } from "@/app/utils/cn";

// As abas Todas, Menções e Mensagens diretas (TabsTrigger, design system), cada uma uma URL, com o
// contador das suas Notificações não lidas. A aba Tarefas entra na F12.
export function ActivityTabs({
  personId,
  active,
  initialUnread,
}: {
  personId: string;
  active: ActivityFilter;
  initialUnread: ActivityUnread | undefined;
}) {
  const unread = useActivityUnread(personId, initialUnread);
  const { mutate } = useSWRConfig();

  // Os números que a página acabou de ler valem mais que os do cache, que o rail gravou na carga.
  useEffect(() => {
    if (initialUnread) void mutate(activityUnreadKey(personId), initialUnread, { revalidate: false });
  }, [initialUnread, mutate, personId]);
  return (
    <nav aria-label="Tipos de atividade" className="flex shrink-0 gap-4 border-b border-border-subtle px-5">
      {ACTIVITY_TABS.map((tab) => {
        const isActive = tab.filter === active;
        const count = unread[tab.count];
        return (
          <Link
            key={tab.filter}
            href={activityTabHref(tab.filter)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2 border-b-2 text-small font-bold",
              isActive ? "border-primary text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            <span>
              {tab.label}
              <span className="sr-only">{unreadSuffix(count)}</span>
            </span>
            <CountBadge count={count} className="h-4.5 min-w-4.5 px-1.5 text-caption font-bold" />
          </Link>
        );
      })}
    </nav>
  );
}
