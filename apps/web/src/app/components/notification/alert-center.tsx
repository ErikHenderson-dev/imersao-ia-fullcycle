"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import { useAnyTabFocused } from "@/app/hooks/use-any-tab-focused";
import { useBrowserNotifications } from "@/app/hooks/use-browser-notifications";
import { useTabFocus } from "@/app/hooks/use-tab-focus";
import { useNotificationItems } from "@/app/hooks/use-notification-items";
import type { Message } from "@/app/services/chat-api";
import { notificationTitle } from "@/app/utils/activity";
import { notificationPreview } from "@/app/utils/browser-notifications";
import { fetchConversationList } from "@/app/services/conversation-list";
import { conversationsKey, messageHref } from "@/app/utils/conversation-list";
import { ALERT_DURATION_MS, notificationDestination } from "@/app/utils/notification-destination";

// O Alerta e a notificação do navegador (spec da F08, "Alerta e notificação do navegador"): uma
// Menção ou uma Mensagem direta que chega ao vivo aparece como toast na aba em foco, com "Abrir", ou,
// sem nenhuma aba do chat em foco e com a opção ligada, como notificação do navegador. Os dois levam
// à Mensagem. O reenvio da reconexão não alerta.
export function AlertCenter({ personId }: { personId: string }) {
  const router = useRouter();
  const isTabFocused = useTabFocus();
  const isAnyTabFocused = useAnyTabFocused();
  const browser = useBrowserNotifications();
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
    const isBrowserEnabled = browser.state === "on";
    const destination = notificationDestination({
      kind: item?.kind ?? null,
      isTabFocused,
      isConversationOpen: isOpenAndFocused({ id: message.conversationId }),
      // Só vale perguntar às outras abas quando a resposta pode mandar ao navegador.
      isAnyTabFocused: isTabFocused || !isBrowserEnabled || !item ? isTabFocused : await isAnyTabFocused(),
      isBrowserEnabled,
    });
    if (!item || destination === "none") return;
    const href = messageHref(message.conversationId, message.id);
    if (destination === "browser") {
      // Todas as abas sem foco criam a mesma notificação, com o id da Mensagem no tag: o navegador
      // mostra uma só. O clique traz esta aba para a frente na Mensagem.
      try {
        const notification = new Notification(notificationTitle(item), {
          body: notificationPreview(message.body),
          tag: message.id,
        });
        notification.onclick = () => {
          window.focus();
          router.push(href);
          notification.close();
        };
      } catch {
        // Navegadores que só aceitam notificação por service worker (Chrome no Android) recusam o
        // construtor: a Notificação fica em Atividade e no rail.
      }
      return;
    }
    toast(notificationTitle(item), {
      id: message.id,
      description: message.body,
      duration: ALERT_DURATION_MS,
      action: {
        label: "Abrir",
        onClick: () => router.push(href),
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
