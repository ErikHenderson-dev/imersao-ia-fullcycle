"use client";

import { useEffect, useId, useRef, useState } from "react";
import { editMessage } from "@/app/actions/edit-message";
import { Button } from "@/app/components/ui/button";
import { Kbd } from "@/app/components/ui/kbd";
import type { Message } from "@/app/services/chat-api";
import { cn } from "@/app/utils/cn";
import { overLimitBy, overLimitLabel } from "@/app/utils/message-text";
import { redirectToExpiredSession } from "@/app/utils/return-path";

type MessageEditorProps = {
  message: Message;
  onSaved: (message: Message) => void;
  onClose: () => void;
};

// Edição no lugar da Mensagem (MessageEditor; spec da F06, "Edição"): Enter salva, Shift+Enter
// quebra a linha e Esc cancela. O limite é o do envio, com o mesmo contador.
export function MessageEditor({ message, onSaved, onClose }: MessageEditorProps) {
  const [text, setText] = useState(message.body);
  const [status, setStatus] = useState<"editing" | "saving" | "error">("editing");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const counterId = useId();
  const errorId = useId();
  const body = text.trim();
  const overLimit = overLimitBy(body);
  const canSave = status !== "saving" && body !== "" && overLimit <= 0;

  // O foco entra no fim do texto.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, []);

  async function save() {
    if (!canSave) return;
    // Sem mudança, fecha sem gravar nem marcar "(editada)".
    if (body === message.body) return onClose();
    setStatus("saving");
    // A rede que cai rejeita a chamada da Server Action: vira o mesmo erro da falha da API.
    const result = await editMessage(message.conversationId, message.id, body).catch(
      () => ({ kind: "failure" }) as const,
    );
    if (result.kind === "unauthenticated") return redirectToExpiredSession();
    if (result.kind === "ok") {
      onSaved(result.message);
      return onClose();
    }
    setStatus("error");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-2 py-1"
    >
      <div
        className={cn(
          "flex rounded-card border bg-surface px-3 py-2 outline-2",
          status === "error" || overLimit > 0
            ? "border-danger outline-danger/30"
            : "border-border-strong focus-within:border-focus focus-within:outline-focus",
        )}
      >
        <textarea
          ref={textareaRef}
          aria-label="Editar mensagem"
          aria-invalid={overLimit > 0 || status === "error" || undefined}
          aria-describedby={
            [overLimit > 0 && counterId, status === "error" && errorId].filter(Boolean).join(" ") ||
            undefined
          }
          value={text}
          readOnly={status === "saving"}
          onChange={(event) => {
            setText(event.target.value);
            if (status === "error") setStatus("editing");
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // O Esc é da edição: não fecha o painel de perfil nem outra camada.
              event.preventDefault();
              if (status !== "saving") onClose();
              return;
            }
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void save();
            }
          }}
          className="field-sizing-content max-h-60 min-h-[22px] flex-1 resize-none bg-transparent text-body text-fg outline-none"
        />
      </div>
      {overLimit > 0 && (
        <p id={counterId} className="text-caption text-danger-fg">
          {overLimitLabel(overLimit)}
        </p>
      )}
      {status === "error" && (
        <p id={errorId} role="alert" className="text-small text-danger-fg">
          Não foi possível salvar a edição.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" loading={status === "saving"} disabled={!canSave}>
          {status === "error" ? "Tentar de novo" : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={status === "saving"}
          onClick={onClose}
        >
          Cancelar
        </Button>
        <p className="flex items-center gap-1 text-caption text-fg-muted">
          <Kbd>Enter</Kbd>
          <span>salva ·</span>
          <Kbd>Esc</Kbd>
          <span>cancela</span>
        </p>
      </div>
    </form>
  );
}
