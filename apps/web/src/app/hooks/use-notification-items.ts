"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import type { ActivityItem, Conversation, Message } from "@/app/services/chat-api";
import { notificationKindFor } from "@/app/utils/activity-cache";
import { useVisibleUnread } from "./use-visible-unread";

// O item de Atividade que uma Mensagem é para a Pessoa, ou nulo (spec da F08): a Atividade, o
// Alerta e a notificação do navegador decidem por ele. A Conversa vem da lista de Conversas no
// cache ou, numa Conversa direta nova, do evento de entrada, que chega antes de a lista trazê-la
// (ADR 0025). `joinedIds` são as Conversas em que a própria Pessoa acabou de entrar, que ela ainda
// não leu.
export function useNotificationItems(
  personId: string,
  initialConversations?: readonly Conversation[],
): {
  conversations: readonly Conversation[];
  // A regra da Conversa aberta com a aba em foco, a mesma da barra lateral (F07).
  isOpenAndFocused: (conversation: Pick<Conversation, "id">) => boolean;
  itemFor: (message: Message) => ActivityItem | null;
  joinedIds: ReadonlySet<string>;
} {
  const { conversations, isOpenAndFocused } = useVisibleUnread(personId, initialConversations);
  const { subscribe } = useRealtime();
  // A ref serve o evento que chega logo depois, antes da próxima renderização; o conjunto em estado,
  // a renderização.
  const joined = useRef(new Map<string, Conversation>());
  const [joinedIds, setJoinedIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(
    () =>
      subscribe({
        onMemberAdded: ({ conversation, personIds }) => {
          joined.current.set(conversation.id, conversation);
          // Um Membro antigo recebe o evento quando outra Pessoa entra.
          if (personIds.includes(personId)) {
            setJoinedIds((current) => new Set(current).add(conversation.id));
          }
        },
      }),
    [subscribe, personId],
  );

  // Estável, para quem o chama de dentro de uma assinatura do tempo real: lê a lista mais recente,
  // atualizada logo depois de cada renderização, antes de qualquer evento do socket.
  const latest = useRef(conversations);
  useLayoutEffect(() => {
    latest.current = conversations;
  }, [conversations]);
  const itemFor = useCallback(
    (message: Message): ActivityItem | null => {
      const conversation =
        latest.current.find((entry) => entry.id === message.conversationId) ??
        joined.current.get(message.conversationId);
      const kind = notificationKindFor(message, conversation, personId);
      return kind && conversation ? { kind, message, conversation } : null;
    },
    [personId],
  );

  return { conversations, isOpenAndFocused, itemFor, joinedIds };
}
