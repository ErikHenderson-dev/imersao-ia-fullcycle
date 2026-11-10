"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { CountBadge } from "@/app/components/ui/count-badge";
import { useActivityUnread } from "@/app/hooks/use-activity-unread";
import type { ActivityUnread } from "@/app/services/chat-api";
import { unreadSuffix } from "@/app/utils/activity";
import { activityUnreadKey } from "@/app/utils/activity-cache";
import { cn } from "@/app/utils/cn";

// O link Atividade do rail, com o número de Notificações não lidas (spec da F08, "Rail"). Os
// números lidos pelo servidor entram no cache, onde a tela Atividade também os lê.
export function ActivityLink({
  personId,
  initialUnread,
}: {
  personId: string;
  initialUnread: ActivityUnread | null;
}) {
  const { mutate } = useSWRConfig();
  const unread = useActivityUnread(personId, initialUnread ?? undefined);
  const isActive = usePathname().startsWith("/atividade");

  useEffect(() => {
    if (initialUnread) void mutate(activityUnreadKey(personId), initialUnread, { revalidate: false });
  }, [initialUnread, mutate, personId]);

  return (
    <Link
      href="/atividade"
      aria-current={isActive ? "page" : undefined}
      className="flex w-full flex-col items-center gap-1 rounded-card py-1 text-sidebar-fg"
    >
      <span
        className={cn(
          "relative flex size-9 items-center justify-center rounded-card",
          isActive && "bg-sidebar-field",
        )}
      >
        <Bell size={20} aria-hidden />
        <CountBadge count={unread.totalCount} className="absolute -right-1.5 -top-1 ring-2 ring-chrome" />
      </span>
      <span className="text-caption font-bold">
        Atividade<span className="sr-only">{unreadSuffix(unread.totalCount)}</span>
      </span>
    </Link>
  );
}
