"use client";

import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { useActivityUnread } from "@/app/hooks/use-activity-unread";
import { fetchActivityPage } from "@/app/services/activity-pages";
import { redirectToExpiredSession } from "@/app/utils/return-path";

// "Marcar tudo como lido" (spec da F08, "Tela Atividade"): desabilitado sem Notificações não lidas;
// marca até a Notificação mais nova de Todas, lida na hora do clique, e mostra "Marcando tudo"
// enquanto espera. Os números da tela mudam pelo activity.unread, e não pela resposta.
export function MarkAllReadButton({ personId }: { personId: string }) {
  const { totalCount } = useActivityUnread(personId);
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
