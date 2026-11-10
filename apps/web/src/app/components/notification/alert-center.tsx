"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import { useTabFocus } from "@/app/hooks/use-tab-focus";
import { useNotificationItems } from "@/app/hooks/use-notification-items";
import type { Message } from "@/app/services/chat-api";
import { notificationTitle } from "@/app/utils/activity";
import { conversationHref, messageHref } from "@/app/utils/conversation-list";
import { ALERT_DURATION_MS, notificationDestination } from "@/app/utils/notification-destination";

// O Alerta (spec da F08, "Alerta e notificação do navegador"): uma Menção ou uma Mensagem direta que
// chega ao vivo aparece como toast na aba em foco, com "Abrir", que leva à Mensagem. O reenvio da
// reconexão não alerta.
export function AlertCenter({ personId }: { personId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isTabFocused = useTabFocus();
  const { itemFor } = useNotificationItems(personId);
  const { subscribe } = useRealtime();

  const alertFor = useEffectEvent((message: Message) => {
    const item = itemFor(message);
    const destination = notificationDestination({
      kind: item?.kind ?? null,
      isTabFocused,
      isConversationOpen: pathname === conversationHref({ id: message.conversationId }),
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
          if (!isReplay) alertFor(message);
        },
      }),
    [subscribe],
  );

  return null;
}
