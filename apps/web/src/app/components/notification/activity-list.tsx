"use client";

import { useEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/app/components/ui/button";
import { useVisibleUnread } from "@/app/hooks/use-visible-unread";
import { type ActivityPageKey, fetchActivityPage } from "@/app/services/activity-pages";
import type { ActivityFilter, ActivityPage, Conversation } from "@/app/services/chat-api";
import { isNotificationRead, relativeTime } from "@/app/utils/activity";
import { ActivityEmpty } from "./activity-empty";
import { ActivitySkeleton } from "./activity-skeleton";
import { NotificationItem } from "./notification-item";

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
      return ["activity", personId, filter, previous.items[0].message.id];
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
  const { conversations } = useVisibleUnread(personId, initialConversations);
  const lastRead = new Map(conversations.map((conversation) => [conversation.id, conversation.lastReadMessageId]));
  const pages = data ?? [initialPage];
  const items = pages.flatMap((page) => page.items.toReversed());
  const hasMore = pages.at(-1)?.hasMore ?? false;
  const isLoadingMore = isValidating && size > pages.length;
  const sentinel = useRef<HTMLDivElement>(null);
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
        {items.map((item) => (
          <NotificationItem
            key={item.message.id}
            item={item}
            isRead={isNotificationRead(item.message.id, lastRead.get(item.conversation.id) ?? null)}
            time={relativeTime(item.message.createdAt, now, timeZone)}
          />
        ))}
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
