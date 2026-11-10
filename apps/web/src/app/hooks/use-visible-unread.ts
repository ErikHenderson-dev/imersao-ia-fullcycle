"use client";

import useSWR from "swr";
import type { Conversation } from "@/app/services/chat-api";
import { conversationsKey } from "@/app/utils/conversation-list";
import { useIsOpenAndFocused } from "./use-is-open-and-focused";

const NO_CONVERSATIONS: readonly Conversation[] = [];

// A lista de Conversas que a barra lateral mantém no cache global do SWR, sem buscar nada, e a
// regra da Conversa aberta com a aba em foco (spec da F07): o título da aba e o marcador do Início
// leem os números dela. O cache só tem a lista porque a barra lateral põe nele a lista do servidor
// ao montar (o fallbackData não grava no cache), como o botão de Membros já supõe.
export function useVisibleUnread(personId: string): {
  conversations: readonly Conversation[];
  isOpenAndFocused: (conversation: Conversation) => boolean;
} {
  const { data } = useSWR<readonly Conversation[]>(conversationsKey(personId), null);
  return { conversations: data ?? NO_CONVERSATIONS, isOpenAndFocused: useIsOpenAndFocused() };
}
