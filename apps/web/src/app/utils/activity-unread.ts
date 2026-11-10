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
  };
}
