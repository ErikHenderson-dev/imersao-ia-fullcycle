"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import { useTabFocus } from "@/app/hooks/use-tab-focus";
import { useVisibleUnread } from "@/app/hooks/use-visible-unread";
import type { Conversation, Message } from "@/app/services/chat-api";
import { notificationTitle } from "@/app/utils/activity";
import { notificationKindFor } from "@/app/utils/activity-cache";
import { conversationHref, messageHref } from "@/app/utils/conversation-list";
import { ALERT_DURATION_MS, notificationDestination } from "@/app/utils/notification-destination";

// O Alerta (spec da F08, "Alerta e notificação do navegador"): uma Menção ou uma Mensagem direta que
// chega ao vivo aparece como toast na aba em foco, com "Abrir", que leva à Mensagem. O reenvio da
// reconexão não alerta.
export function AlertCenter({ personId }: { personId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isTabFocused = useTabFocus();
  const { conversations } = useVisibleUnread(personId);
  const { subscribe } = useRealtime();
  // A Conversa direta nova chega pelo evento de entrada, antes de a lista de Conversas trazê-la.
  const joined = useRef(new Map<string, Conversation>());

  const alertFor = useEffectEvent((message: Message) => {
    const conversation =
      conversations.find((entry) => entry.id === message.conversationId) ??
      joined.current.get(message.conversationId);
    const kind = notificationKindFor(message, conversation, personId);
    const destination = notificationDestination({
      kind,
      isTabFocused,
      isConversationOpen: pathname === conversationHref({ id: message.conversationId }),
    });
    if (destination !== "alert" || !kind || !conversation) return;
    toast(notificationTitle({ kind, message, conversation }), {
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
        onMemberAdded: ({ conversation }) => {
          joined.current.set(conversation.id, conversation);
        },
        onMessage: (message, { isReplay }) => {
          if (!isReplay) alertFor(message);
        },
      }),
    [subscribe],
  );

  return null;
}
