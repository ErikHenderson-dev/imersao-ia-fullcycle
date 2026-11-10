"use client";

import { useRef, useState } from "react";
import { deleteMessage } from "@/app/actions/delete-message";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import type { Message } from "@/app/services/chat-api";
import { redirectToExpiredSession } from "@/app/utils/return-path";

type DeleteMessageDialogProps = {
  message: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // A Mensagem saiu: apagada agora, ou já apagada antes (o 404 da API). O foco, daí em diante, é de
  // quem lista as Mensagens.
  onDeleted: () => void;
};

// "Apagar mensagem?" (spec da F06, "Apagar"): mostra o texto, começa com o foco em Cancelar e não
// fecha pelo clique fora. Enquanto apaga, fica em "Apagando"; na falha, mostra o erro e tenta de
// novo, e a Mensagem continua na Conversa.
export function DeleteMessageDialog({
  message,
  open,
  onOpenChange,
  onDeleted,
}: DeleteMessageDialogProps) {
  const [isDeleting, setDeleting] = useState(false);
  // Depois de apagar, o Radix não devolve o foco ao botão que abriu o menu.
  const wasDeleted = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setDeleting(true);
    setError(null);
    // A rede que cai rejeita a chamada da Server Action: vira a mesma falha da API.
    const result = await deleteMessage(message.conversationId, message.id).catch(
      () => ({ kind: "failure" }) as const,
    );
    setDeleting(false);
    if (result.kind === "unauthenticated") return redirectToExpiredSession();
    if (result.kind === "ok" || result.kind === "not_found") {
      wasDeleted.current = true;
      onOpenChange(false);
      return onDeleted();
    }
    setError("Não foi possível apagar a mensagem.");
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
      title="Apagar mensagem?"
      description="Ela some da conversa para todo mundo. Não dá para desfazer."
      confirmLabel="Apagar"
      onConfirm={() => void confirm()}
      isConfirming={isDeleting}
      error={error}
      onCloseAutoFocus={(event) => {
        if (wasDeleted.current) event.preventDefault();
      }}
    >
      <blockquote className="line-clamp-3 whitespace-pre-wrap break-words rounded-control border-l-4 border-border-strong bg-surface-inset px-3 py-2 text-body text-fg">
        {message.body}
      </blockquote>
    </ConfirmDialog>
  );
}
