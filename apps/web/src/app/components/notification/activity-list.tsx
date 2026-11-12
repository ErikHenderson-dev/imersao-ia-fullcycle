"use client";

import { useEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/app/components/ui/button";
import { useActivityUnread } from "@/app/hooks/use-activity-unread";
import { useNotificationItems } from "@/app/hooks/use-notification-items";
import { type ActivityPageKey, fetchActivityPage } from "@/app/services/activity-pages";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import type {
  ActivityFilter,
  ActivityItem,
  ActivityPage,
  Conversation,
} from "@/app/services/chat-api";
import { applyCreated, applyDeleted, applyUpdated } from "@/app/utils/activity-cache";
import { uuidV7Instant } from "@/app/utils/uuid";
import {
  activityItemId,
  isNotificationRead,
  isTaskNotificationRead,
  relativeTime,
  taskItemFromEvent,
} from "@/app/utils/activity";
import { ActivityEmpty } from "./activity-empty";
import { ActivitySkeleton } from "./activity-skeleton";
import { NotificationItem } from "./notification-item";
import { TaskNotificationItem } from "./task-notification-item";

type ActivityListProps = {
  personId: string;
  filter: ActivityFilter;
  // A primeira página, lida pelo servidor.
  initialPage: ActivityPage;
  timeZone: string;
  // A lista de Conversas lida pelo servidor, com a Última leitura de cada uma, até o cache existir.
  initialConversations: readonly Conversation[];
};

// A lista de uma aba de Atividade (spec da F08, "Tela Atividade"): a primeira página vem do RSC, e
// rolar até o fim carrega as anteriores pela rota do BFF. A mais nova fica em cima. O estado de lido
// sai da Última leitura de cada Conversa, no cache da lista de Conversas.
export function ActivityList({
  personId,
  filter,
  initialPage,
  timeZone,
  initialConversations,
}: ActivityListProps) {
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<
    ActivityPage,
    Error,
    (index: number, previous: ActivityPage | null) => ActivityPageKey | null
  >(
    (index, previous) => {
      if (index === 0) return ["activity", personId, filter, null];
      if (!previous?.hasMore || previous.items.length === 0) return null;
      return ["activity", personId, filter, activityItemId(previous.items[0])];
    },
    fetchActivityPage,
    {
      fallbackData: [initialPage],
      revalidateFirstPage: false,
      revalidateOnMount: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );
  const { conversations, itemFor, joinedIds } = useNotificationItems(personId, initialConversations);

  // O tempo real muda as páginas carregadas desta aba, sem buscar nada (spec da F08, "Tela
  // Atividade").
  const { subscribe } = useRealtime();
  useEffect(
    () =>
      subscribe({
        onMessage: (message) => {
          const item = itemFor(message);
          if (item) void mutate((current) => applyCreated(current ?? [], item, filter), { revalidate: false });
        },
        onMessageUpdated: (message) =>
          void mutate((current) => applyUpdated(current ?? [], message, itemFor(message), filter), {
            revalidate: false,
          }),
        onMessageDeleted: ({ messageId }) =>
          void mutate((current) => applyDeleted(current ?? [], messageId), { revalidate: false }),
        // A Notificação de Tarefa nova entra em Todas (spec da F12, "Cliente (web)").
        onTask: (task, _arrival, notification) => {
          const item = notification && taskItemFromEvent(task, notification);
          if (item) void mutate((current) => applyCreated(current ?? [], item, filter), { revalidate: false });
        },
        // Depois de uma queda longa, as páginas são buscadas de novo.
        onSync: (event) => {
          if (event.reset) void mutate();
        },
        replayLastReset: true,
      }),
    [subscribe, mutate, filter, itemFor],
  );
  const lastRead = new Map(conversations.map((conversation) => [conversation.id, conversation.lastReadMessageId]));
  // O fallbackData já devolve a primeira página enquanto o cache está vazio.
  const pages = data ?? [];
  // Sem a Conversa na lista (a lista falhou), o item não acende como não lido; a Conversa direta que
  // acabou de chegar pelo evento de entrada ainda não foi lida.
  const { activityReadMessageId } = useActivityUnread(personId);
  const isItemRead = (item: ActivityItem) => {
    if (item.kind === "task") return isTaskNotificationRead(item, activityReadMessageId);
    const id = item.conversation.id;
    if (lastRead.has(id)) {
      return isNotificationRead(item.message.id, lastRead.get(id) ?? null, activityReadMessageId);
    }
    return !joinedIds.has(id) || isNotificationRead(item.message.id, null, activityReadMessageId);
  };
  const items = pages.flatMap((page) => page.items.toReversed());
  // A Notificação de Tarefa aberta fica lida na lista na hora, sem esperar outra leitura.
  const markOpened = (notificationId: string) =>
    void mutate(
      (current) =>
        current?.map((page) => ({
          ...page,
          items: page.items.map((entry) =>
            entry.kind === "task" && entry.notification.id === notificationId
              ? { ...entry, notification: { ...entry.notification, read: true } }
              : entry,
          ),
        })),
      { revalidate: false },
    );
  const hasMore = pages.at(-1)?.hasMore ?? false;
  const isLoadingMore = isValidating && size > pages.length;
  const sentinel = useRef<HTMLDivElement>(null);

  // A primeira página que o servidor acabou de ler vale mais que as páginas do cache, de uma visita
  // anterior à aba: o cache volta a ela, e só ela. Assim a próxima página parte dela, sem buscar a
  // primeira de novo.
  useEffect(() => {
    void setSize(1);
    void mutate([initialPage], { revalidate: false });
  }, [initialPage, mutate, setSize]);
  // A hora da montagem: o tempo relativo não anda sozinho com a tela aberta (plano da F08-T01).
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || error) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void setSize((current) => current + 1);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, error, setSize, pages.length]);

  if (items.length === 0 && !hasMore) return <ActivityEmpty filter={filter} />;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ul aria-label="Notificações" className="flex flex-col">
        {items.map((item) =>
          item.kind === "task" ? (
            <TaskNotificationItem
              key={item.notification.id}
              item={item}
              isRead={isItemRead(item)}
              time={relativeTime(uuidV7Instant(item.notification.id).toISOString(), now, timeZone)}
              onOpen={() => markOpened(item.notification.id)}
            />
          ) : (
            <NotificationItem
              key={item.message.id}
              item={item}
              isRead={isItemRead(item)}
              time={relativeTime(item.message.createdAt, now, timeZone)}
            />
          ),
        )}
      </ul>
      {isLoadingMore && <ActivitySkeleton rows={2} />}
      {error && !isLoadingMore && (
        <div role="alert" className="flex flex-col items-center gap-3 px-6 py-6 text-center">
          <p className="text-body text-fg-muted">Não foi possível carregar mais notificações.</p>
          <Button variant="secondary" size="sm" onClick={() => void mutate()}>
            Tentar de novo
          </Button>
        </div>
      )}
      {hasMore && !error && <div ref={sentinel} className="h-px" />}
    </div>
  );
}
