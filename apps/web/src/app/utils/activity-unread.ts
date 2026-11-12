import type { ActivityUnreadEvent } from "chat-events";
import type { ActivityUnread } from "@/app/services/chat-api";

// Os números de Atividade da API, no REST (`GET /v1/activity/unread`) e no evento `activity.unread`.
export type ActivityUnreadPayload = Omit<ActivityUnreadEvent, "event_id">;

// No formato da web (spec da F08, "Números de Atividade").
export function activityUnreadFromPayload(payload: ActivityUnreadPayload): ActivityUnread {
  return {
    activityReadMessageId: payload.activity_read_message_id,
    totalCount: payload.total_count,
    mentionCount: payload.mention_count,
    directCount: payload.direct_count,
    taskCount: payload.task_count,
  };
}

// Se os números trazem uma marca de "Marcar tudo como lido" mais nova que a do cache: a marca só
// avança, então a mais nova é a mais recente.
export function isNewerMark(next: ActivityUnread, current: ActivityUnread | undefined): boolean {
  if (!next.activityReadMessageId) return false;
  const known = current?.activityReadMessageId ?? null;
  return known === null || next.activityReadMessageId > known;
}
