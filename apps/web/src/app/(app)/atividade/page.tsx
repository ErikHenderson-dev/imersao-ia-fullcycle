import { redirect } from "next/navigation";
import { ActivityError } from "@/app/components/notification/activity-error";
import { ActivityHeader } from "@/app/components/notification/activity-header";
import { ActivityList } from "@/app/components/notification/activity-list";
import { ActivityTabs } from "@/app/components/notification/activity-tabs";
import { MarkAllReadButton } from "@/app/components/notification/mark-all-read-button";
import { TaskBoard } from "@/app/components/task/task-board";
import {
  getActivityUnread,
  getCurrentPerson,
  listActivity,
  listConversations,
  getTask,
  listTasks,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { readTimeZone } from "@/app/services/time-zone-cookie";
import { activityTabFromParam, activityTabHref } from "@/app/utils/activity";
import { isUuid } from "@/app/utils/uuid";
import { expiredSessionPath } from "@/app/utils/return-path";

export const metadata = { title: "Atividade" };

// A tela Atividade (spec da F08, "Tela Atividade"): a aba vem de `?aba=`, e a primeira página e os
// números são lidos aqui, juntos. A aba Tarefas lê a primeira página de cada grupo (spec da F12,
// "Cliente (web)").
export default async function ActivityPage({ searchParams }: PageProps<"/atividade">) {
  const params = await searchParams;
  const filter = activityTabFromParam(params.aba);
  const path = activityTabHref(filter);
  const token = await readSessionToken();
  if (!token) redirect(expiredSessionPath(path));
  if (filter === "tasks") {
    const highlighted = typeof params.tarefa === "string" && isUuid(params.tarefa) ? params.tarefa : null;
    return <TasksTab token={token} path={path} highlightedId={highlighted} />;
  }
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
      <ActivityHeader action={personId && <MarkAllReadButton personId={personId} />} />
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

async function TasksTab({ token, path, highlightedId }: { token: string; path: string; highlightedId: string | null }) {
  const [person, assigned, delegated, unread, timeZone, highlighted] = await Promise.all([
    getCurrentPerson(token),
    listTasks(token, { role: "assigned" }),
    listTasks(token, { role: "delegated" }),
    getActivityUnread(token),
    readTimeZone(),
    highlightedId ? getTask(token, highlightedId) : null,
  ]);
  if ([person, assigned, delegated].some((result) => result.kind === "unauthenticated")) {
    redirect(expiredSessionPath(path));
  }
  const personId = person.kind === "ok" ? person.person.id : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActivityHeader action={personId && <MarkAllReadButton personId={personId} />} />
      {personId && (
        <ActivityTabs
          personId={personId}
          active="tasks"
          initialUnread={unread.kind === "ok" ? unread.unread : undefined}
        />
      )}
      {personId && assigned.kind === "ok" && delegated.kind === "ok" ? (
        <TaskBoard
          personId={personId}
          assigned={assigned.page}
          delegated={delegated.page}
          timeZone={timeZone}
          highlightedId={highlightedId}
          highlighted={highlighted?.kind === "ok" ? highlighted.task : null}
        />
      ) : (
        <ActivityError />
      )}
    </div>
  );
}
