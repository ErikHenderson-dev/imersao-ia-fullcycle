"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import type { Message, MessagePage } from "@/app/services/chat-api";
import { newerThan } from "@/app/utils/recent-messages";

type Handlers = {
  currentPersonId: string;
  appendSaved: (message: Message) => void;
  applyEdited: (message: Message) => void;
  dropDelivered: (message: Message) => void;
  reloadLatest: () => Promise<void>;
};

// Liga o histórico de uma Conversa ao tempo real (spec da F03, "Mensagens no histórico"): as
// Mensagens que chegam entram no cache e tiram a pendente de mesmo client_id; o reset recarrega a
// página mais recente. Ao montar, entram as recebidas pelo provedor depois da primeira página.
// Devolve se o histórico já tratou o primeiro sync.
export function useRealtimeMessages(
  conversationId: string,
  initialPage: MessagePage,
  { currentPersonId, appendSaved, applyEdited, dropDelivered, reloadLatest }: Handlers,
) {
  const { subscribe, recentMessages } = useRealtime();
  // Verdadeiro depois do primeiro sync tratado (com a recarga do reset terminada): o histórico
  // está em dia com o tempo real.
  const [isSynced, setSynced] = useState(false);

  const receive = useEffectEvent((message: Message) => {
    if (message.conversationId !== conversationId) return;
    appendSaved(message);
    // Só a Mensagem da própria Pessoa pode estar entre as pendentes.
    if (message.author.id === currentPersonId) dropDelivered(message);
  });
  const receiveEdit = useEffectEvent((message: Message) => {
    if (message.conversationId === conversationId) applyEdited(message);
  });
  const onSync = useEffectEvent((reset: boolean) => {
    if (!reset) return setSynced(true);
    void reloadLatest().finally(() => setSynced(true));
  });
  const catchUp = useEffectEvent(() => {
    const newest = initialPage.messages.at(-1)?.id;
    newerThan(recentMessages(conversationId), newest).forEach(receive);
  });

  useEffect(() => {
    catchUp();
    return subscribe({
      onMessage: (message) => receive(message),
      onMessageUpdated: (message) => receiveEdit(message),
      onSync: (event) => onSync(event.reset),
    });
  }, [conversationId, subscribe]);

  return { isSynced };
}
