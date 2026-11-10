import { redirect } from "next/navigation";
import { ActivityError } from "@/app/components/notification/activity-error";
import { ActivityHeader } from "@/app/components/notification/activity-header";
import { ActivityList } from "@/app/components/notification/activity-list";
import { ActivityTabs } from "@/app/components/notification/activity-tabs";
import {
  getActivityUnread,
  getCurrentPerson,
  listActivity,
  listConversations,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { readTimeZone } from "@/app/services/time-zone-cookie";
import { activityFilterFromTab, activityTabHref } from "@/app/utils/activity";
import { expiredSessionPath } from "@/app/utils/return-path";

export const metadata = { title: "Atividade" };

// A tela Atividade (spec da F08, "Tela Atividade"): a aba vem de `?aba=`, e a primeira página e os
// números são lidos aqui, juntos.
export default async function ActivityPage({ searchParams }: PageProps<"/atividade">) {
  const filter = activityFilterFromTab((await searchParams).aba);
  const path = activityTabHref(filter);
  const token = await readSessionToken();
  if (!token) redirect(expiredSessionPath(path));
  // A lista de Conversas é a mesma que a barra lateral lê (memorizada por requisição).
  const [person, page, unread, timeZone, conversations] = await Promise.all([
    getCurrentPerson(token),
    listActivity(token, { kind: filter }),
    getActivityUnread(token),
    readTimeZone(),
    listConversations(token),
  ]);
  if (person.kind === "unauthenticated" || page.kind === "unauthenticated") {
    redirect(expiredSessionPath(path));
  }
  const personId = person.kind === "ok" ? person.person.id : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActivityHeader />
      {personId && (
        <ActivityTabs
          personId={personId}
          active={filter}
          initialUnread={unread.kind === "ok" ? unread.unread : undefined}
        />
      )}
      {page.kind === "ok" && personId ? (
        <ActivityList
          key={filter}
          personId={personId}
          filter={filter}
          initialPage={page.page}
          timeZone={timeZone}
          initialConversations={conversations.kind === "ok" ? conversations.conversations : []}
        />
      ) : (
        <ActivityError />
      )}
    </div>
  );
}
