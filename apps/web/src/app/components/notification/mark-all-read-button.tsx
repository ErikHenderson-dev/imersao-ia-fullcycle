"use client";

import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { useActivityUnread } from "@/app/hooks/use-activity-unread";
import { fetchActivityPage } from "@/app/services/activity-pages";
import type { ActivityUnread } from "@/app/services/chat-api";
import { activityUnreadKey } from "@/app/utils/activity-cache";
import { isNewerMark } from "@/app/utils/activity-unread";
import { redirectToExpiredSession } from "@/app/utils/return-path";

// "Marcar tudo como lido" (spec da F08, "Tela Atividade"): desabilitado sem Notificações não lidas;
// marca até a Notificação mais nova de Todas, lida na hora do clique, e mostra "Marcando tudo"
// enquanto espera. Os números da tela mudam pelo activity.unread, e a resposta só vale sem ele.
export function MarkAllReadButton({ personId }: { personId: string }) {
  const { totalCount } = useActivityUnread(personId);
  const { mutate } = useSWRConfig();
  const [isMarking, setIsMarking] = useState(false);

  async function markAll() {
    setIsMarking(true);
    try {
      const page = await fetchActivityPage(["activity", personId, "all", null]);
      const newest = page.items.at(-1);
      if (!newest) return;
      const response = await fetch("/api/activity/read", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: newest.message.id }),
      });
      if (response.status === 401) return redirectToExpiredSession();
      if (!response.ok) throw new Error("Falha ao marcar como lido.");
      // Sem o evento (a conexão caiu ou a publicação falhou), os números da resposta valem; só não
      // passam por cima de um evento que já trouxe esta marca ou uma mais nova.
      const marked = (await response.json()) as ActivityUnread;
      void mutate(
        activityUnreadKey(personId),
        (current?: ActivityUnread) => (isNewerMark(marked, current) ? marked : current),
        { revalidate: false },
      );
    } catch {
      toast.error("Não foi possível marcar como lido.");
    } finally {
      setIsMarking(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      icon={CheckCheck}
      loading={isMarking}
      disabled={totalCount === 0}
      onClick={() => void markAll()}
    >
      Marcar tudo como lido
    </Button>
  );
}
