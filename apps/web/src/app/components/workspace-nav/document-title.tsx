"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useVisibleUnread } from "@/app/hooks/use-visible-unread";
import { unreadTitle } from "@/app/utils/unread";

// O título da aba com a soma dos contadores visíveis (spec da F07, "Título da aba e rail"). É
// reaplicado a cada navegação, porque o Next.js troca o título pelo da página.
export function DocumentTitle({ personId }: { personId: string }) {
  const { conversations, isOpenAndFocused } = useVisibleUnread(personId);
  const title = unreadTitle(conversations, isOpenAndFocused);
  const pathname = usePathname();
  useEffect(() => {
    document.title = title;
  }, [title, pathname]);
  return null;
}
