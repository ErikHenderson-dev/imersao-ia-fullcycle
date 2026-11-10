import { getActivityUnread } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { ActivityLink } from "./activity-link";

// Lê os números de Atividade no servidor para o link do rail. Uma falha deixa o link sem número.
export async function ActivityNav({ personId }: { personId: string }) {
  const token = await readSessionToken();
  const result = token ? await getActivityUnread(token) : null;
  return (
    <ActivityLink personId={personId} initialUnread={result?.kind === "ok" ? result.unread : null} />
  );
}
