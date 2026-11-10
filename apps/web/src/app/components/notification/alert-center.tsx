"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import { useTabFocus } from "@/app/hooks/use-tab-focus";
import { useNotificationItems } from "@/app/hooks/use-notification-items";
import type { Message } from "@/app/services/chat-api";
import { notificationTitle } from "@/app/utils/activity";
import { fetchConversationList } from "@/app/services/conversation-list";
import { conversationsKey, messageHref } from "@/app/utils/conversation-list";
import { ALERT_DURATION_MS, notificationDestination } from "@/app/utils/notification-destination";

// O Alerta (spec da F08, "Alerta e notificação do navegador"): uma Menção ou uma Mensagem direta que
// chega ao vivo aparece como toast na aba em foco, com "Abrir", que leva à Mensagem. O reenvio da
// reconexão não alerta.
export function AlertCenter({ personId }: { personId: string }) {
  const router = useRouter();
  const isTabFocused = useTabFocus();
  const { itemFor, isOpenAndFocused, conversations } = useNotificationItems(personId);
  const { mutate } = useSWRConfig();
  const hasConversation = (id: string) => conversations.some((entry) => entry.id === id);
  const { subscribe } = useRealtime();

  const alertFor = useEffectEvent(async (message: Message) => {
    let item = itemFor(message);
    // Na carga da página, a lista de Conversas ainda pode não estar no cache (a barra lateral
    // carrega à parte): sem a Conversa, ela é buscada e a decisão é refeita.
    if (!item && !hasConversation(message.conversationId)) {
      await mutate(conversationsKey(personId), fetchConversationList()).catch(() => {});
      item = itemFor(message);
    }
    const destination = notificationDestination({
      kind: item?.kind ?? null,
      isTabFocused,
      isConversationOpen: isOpenAndFocused({ id: message.conversationId }),
    });
    if (destination !== "alert" || !item) return;
    toast(notificationTitle(item), {
      id: message.id,
      description: message.body,
      duration: ALERT_DURATION_MS,
      action: {
        label: "Abrir",
        onClick: () => router.push(messageHref(message.conversationId, message.id)),
      },
    });
  });

  useEffect(
    () =>
      subscribe({
        onMessage: (message, { isReplay }) => {
          if (!isReplay) void alertFor(message);
        },
      }),
    [subscribe],
  );

  return null;
}
