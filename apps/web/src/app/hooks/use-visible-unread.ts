"use client";

import { usePathname } from "next/navigation";
import useSWR from "swr";
import type { Conversation } from "@/app/services/chat-api";
import { conversationHref, conversationsKey } from "@/app/utils/conversation-list";
import { useTabFocus } from "./use-tab-focus";

const NO_CONVERSATIONS: readonly Conversation[] = [];

// A lista de Conversas que a barra lateral mantém no cache global do SWR, sem buscar nada, e a
// regra da Conversa aberta com a aba em foco, a mesma da barra lateral (spec da F07): o título da
// aba e o marcador do Início leem os números dela.
export function useVisibleUnread(personId: string): {
  conversations: readonly Conversation[];
  isOpenAndFocused: (conversation: Conversation) => boolean;
} {
  const { data } = useSWR<readonly Conversation[]>(conversationsKey(personId), null);
  const pathname = usePathname();
  const isTabFocused = useTabFocus();
  return {
    conversations: data ?? NO_CONVERSATIONS,
    isOpenAndFocused: (conversation) => isTabFocused && conversationHref(conversation) === pathname,
  };
}
