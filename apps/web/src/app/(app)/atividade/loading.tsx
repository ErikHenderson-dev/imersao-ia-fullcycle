import { ActivityHeader } from "@/app/components/notification/activity-header";
import { ActivitySkeleton } from "@/app/components/notification/activity-skeleton";

// "Atividade / Notificações carregando": o cabeçalho e as linhas em pulso, enquanto a página lê a
// lista.
export default function ActivityLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActivityHeader />
      <div className="h-9 shrink-0 border-b border-border-subtle" />
      <ActivitySkeleton />
    </div>
  );
}
