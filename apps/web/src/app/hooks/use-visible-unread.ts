"use client";

import useSWR from "swr";
import type { Conversation } from "@/app/services/chat-api";
import { fetchConversationList } from "@/app/services/conversation-list";
import { conversationsKey } from "@/app/utils/conversation-list";
import { useIsOpenAndFocused } from "./use-is-open-and-focused";

const NO_CONVERSATIONS: readonly Conversation[] = [];

// A lista de Conversas que a barra lateral mantém no cache global do SWR, sem buscar nada, e a
// regra da Conversa aberta com a aba em foco (spec da F07): o título da aba e o marcador do Início
// leem os números dela. O cache só tem a lista porque a barra lateral põe nele a lista do servidor
// ao montar (o fallbackData não grava no cache).
// `fallback` é a lista que quem chama já leu no servidor: com ela, a primeira renderização (no
// servidor e na hidratação) já sai com a Última leitura certa (F08, a tela Atividade).
export function useVisibleUnread(
  personId: string,
  fallback?: readonly Conversation[],
): {
  conversations: readonly Conversation[];
  isOpenAndFocused: (conversation: Pick<Conversation, "id">) => boolean;
} {
  // Com a mesma busca da barra lateral, sem buscar sozinho: o reset do tempo real revalida a chave
  // pela busca do primeiro hook registrado nela, que pode ser este.
  const { data } = useSWR(conversationsKey(personId), fetchConversationList, {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return {
    conversations: data ?? fallback ?? NO_CONVERSATIONS,
    isOpenAndFocused: useIsOpenAndFocused(),
  };
}
