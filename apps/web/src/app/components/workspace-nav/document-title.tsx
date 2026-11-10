"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useVisibleUnread } from "@/app/hooks/use-visible-unread";
import { unreadTitle } from "@/app/utils/unread";

// O título da aba com a soma dos contadores visíveis (spec da F07, "Título da aba e rail"). É
// reaplicado a cada navegação e sempre que o Next.js reescreve o título da página, como no refresh
// do layout depois de criar um Canal.
export function DocumentTitle({ personId }: { personId: string }) {
  const { conversations, isOpenAndFocused } = useVisibleUnread(personId);
  const title = unreadTitle(conversations, isOpenAndFocused);
  const pathname = usePathname();
  useEffect(() => {
    document.title = title;
    const observer = new MutationObserver(() => {
      if (document.title !== title) document.title = title;
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title, pathname]);
  return null;
}
