"use client";

import useSWR from "swr";
import type { ActivityUnread } from "@/app/services/chat-api";
import { activityUnreadKey } from "@/app/utils/activity-cache";

const NONE: ActivityUnread = { totalCount: 0, mentionCount: 0, directCount: 0 };

// Os números de Atividade no cache global do SWR, por Pessoa (spec da F08, "Números de
// Atividade"): o rail e as abas leem o mesmo. Quem os traz do servidor passa `initial`; sem busca
// própria, o cache só muda por quem o grava.
export function useActivityUnread(personId: string, initial?: ActivityUnread): ActivityUnread {
  const { data } = useSWR(activityUnreadKey(personId), null, {
    fallbackData: initial,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return data ?? initial ?? NONE;
}
