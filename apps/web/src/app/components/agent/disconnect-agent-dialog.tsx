"use client";

import { useState } from "react";
import { toast } from "sonner";
import { disconnectAgent } from "@/app/actions/agent-connection";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import type { Agent } from "@/app/services/agents-service";
import { redirectToExpiredSession } from "@/app/utils/return-path";

type DisconnectAgentDialogProps = {
  // O Agente a desconectar, ou null com a confirmação fechada.
  agent: Agent | null;
  onClose: () => void;
  onDisconnected: (agent: Agent) => Promise<unknown>;
  onCloseAutoFocus: (event: Event) => void;
};

// "Desconectar <nome>?" (spec da F10, "Diálogo Agentes"): o foco começa em Cancelar, e Esc ou
// Cancelar fecham sem mudar nada. Confirmar mostra "Enviando"; no sucesso, relê a lista e fecha; na
// falha, fecha e mostra o toast, e o Agente continua conectado.
export function DisconnectAgentDialog({
  agent,
  onClose,
  onDisconnected,
  onCloseAutoFocus,
}: DisconnectAgentDialogProps) {
  const [isSending, setIsSending] = useState(false);

  async function confirm(target: Agent) {
    setIsSending(true);
    const result = await disconnectAgent(target.slug).catch(() => ({ kind: "failure" }) as const);
    if (result.kind === "ok") await onDisconnected(target);
    setIsSending(false);
    onClose();
    if (result.kind === "unauthenticated") return redirectToExpiredSession();
    if (result.kind === "forbidden") toast.error("Só administradores desconectam agentes");
    else if (result.kind === "failure") toast.error("Não foi possível desconectar o agente");
  }

  return (
    <ConfirmDialog
      open={agent !== null}
      onOpenChange={(open) => !open && onClose()}
      title={agent ? `Desconectar ${agent.name}?` : ""}
      description={
        agent
          ? `Ninguém mais vai conseguir mencionar @${agent.username} nas conversas. As mensagens que ele já escreveu continuam lá, e você pode conectar de novo quando quiser.`
          : ""
      }
      confirmLabel="Desconectar"
      onConfirm={() => agent && void confirm(agent)}
      isConfirming={isSending}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  );
}
