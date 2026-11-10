"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { type MessageDeleted, useRealtime } from "@/app/components/realtime/realtime-provider";
import type { Message, MessagePage } from "@/app/services/chat-api";
import { newerThan } from "@/app/utils/recent-messages";

type Handlers = {
  currentPersonId: string;
  appendSaved: (message: Message) => void;
  applyEdited: (message: Message) => void;
  applyDeleted: (messageId: string) => void;
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
  { currentPersonId, appendSaved, applyEdited, applyDeleted, dropDelivered, reloadLatest }: Handlers,
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
  const receiveDelete = useEffectEvent((deleted: MessageDeleted) => {
    if (deleted.conversationId === conversationId) applyDeleted(deleted.messageId);
  });
  const onSync = useEffectEvent((reset: boolean) => {
    if (!reset) return setSynced(true);
    void reloadLatest().finally(() => setSynced(true));
  });
  const catchUp = useEffectEvent(() => {
    const recent = recentMessages(conversationId);
    const newest = initialPage.messages.at(-1)?.id;
    newerThan(recent, newest).forEach(receive);
    // As edições recebidas enquanto a Conversa não estava aberta valem também para as Mensagens da
    // primeira página; a troca só acontece se a edição for mais nova.
    recent.filter((message) => message.editedAt).forEach(receiveEdit);
  });

  useEffect(() => {
    catchUp();
    return subscribe({
      onMessage: (message) => receive(message),
      onMessageUpdated: (message) => receiveEdit(message),
      onMessageDeleted: (deleted) => receiveDelete(deleted),
      onSync: (event) => onSync(event.reset),
    });
  }, [conversationId, subscribe]);

  return { isSynced };
}
