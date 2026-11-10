"use client";

import { usePathname } from "next/navigation";
import type { Conversation } from "@/app/services/chat-api";
import { conversationHref } from "@/app/utils/conversation-list";
import { useTabFocus } from "./use-tab-focus";

// A Conversa está aberta com a aba em foco: a barra lateral, o título da aba e o marcador do Início
// não mostram nada de novo dela (spec da F07).
export function useIsOpenAndFocused(): (conversation: Pick<Conversation, "id">) => boolean {
  const pathname = usePathname();
  const isTabFocused = useTabFocus();
  return (conversation) => isTabFocused && conversationHref(conversation) === pathname;
}
