"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { OpenProfileButton } from "@/app/components/profile/open-profile-button";
import { Avatar } from "@/app/components/ui/avatar";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/utils/cn";
import type { Message } from "@/app/services/chat-api";
import { formatTime } from "@/app/utils/format-time";
import { DayDivider } from "./day-divider";
import { MessageActions } from "./message-actions";
import { MessageBody } from "./message-body";
import { MessageEditor } from "./message-editor";

type MessageItemProps = {
  message: Message;
  timeZone: string;
  // Forma compacta (22:7404): sem avatar nem nome, com a hora na calha ao passar o mouse ou com o
  // foco do teclado na área do histórico.
  compact?: boolean;
  // Rótulo do divisor de dia, na primeira Mensagem de cada dia.
  dayLabel?: string;
  // Estado do envio (22:11072 e 22:12030): "sent" para as gravadas.
  status?: "sent" | "sending" | "failed";
  onRetry?: () => void;
  onDiscard?: () => void;
  // A edição (spec da F06, "Edição"), só nas Mensagens da Pessoa logada: com `isEditing`, a
  // MessageEditor toma o lugar do texto.
  edit?: MessageEdit;
  // A Pessoa logada: a Menção a ela é amarela, e a Mensagem que a menciona ganha o destaque de
  // "Menciona você" (spec da F06, "Texto da Mensagem").
  currentPersonId?: string;
};

export type MessageEdit = {
  isEditing: boolean;
  start: () => void;
  onSaved: (message: Message) => void;
  onClose: () => void;
  // A Mensagem saiu: apagada aqui, em outra aba, ou o 404 da edição (spec da F06, "Apagar").
  onDeleted: () => void;
};

// Mensagem (MessageItem), no layout completo ou compacto. A barra de ações e o menu (spec da F06,
// "Barra de ações e menu") só existem na Mensagem gravada: "enviando" e "falhou" não têm.
export function MessageItem({
  message,
  timeZone,
  compact = false,
  dayLabel,
  status = "sent",
  onRetry,
  onDiscard,
  edit,
  currentPersonId,
}: MessageItemProps) {
  const mentionsMe = message.mentions.some((mention) => mention.id === currentPersonId);
  const isEditing = edit?.isEditing ?? false;
  const itemRef = useRef<HTMLLIElement>(null);
  // Ao fechar a edição, o foco volta para a Mensagem, no "Editar" da barra.
  const wasEditing = useRef(isEditing);
  useEffect(() => {
    if (wasEditing.current && !isEditing) {
      itemRef.current?.querySelector<HTMLElement>('[data-action="edit"]')?.focus();
    }
    wasEditing.current = isEditing;
  }, [isEditing]);
  const failed = status === "failed" && (
    <SendFailure onRetry={onRetry} onDiscard={onDiscard} />
  );
  const content = edit?.isEditing ? (
    <MessageEditor
      message={message}
      onSaved={edit.onSaved}
      onClose={edit.onClose}
      onGone={edit.onDeleted}
    />
  ) : (
    <>
      <MessageBody
        text={message.body}
        mentions={message.mentions}
        currentPersonId={currentPersonId}
        edited={message.editedAt}
        timeZone={timeZone}
      />
      {failed}
    </>
  );
  return (
    <li
      ref={itemRef}
      data-message-id={message.id}
      data-layout={compact ? "compact" : "full"}
      data-status={status}
      aria-busy={status === "sending" || undefined}
      className={cn("flex flex-col", status === "sending" && "opacity-60")}
    >
      {dayLabel && <DayDivider label={dayLabel} />}
      <div
        data-mentions-me={mentionsMe || undefined}
        className={cn(
          "group/message relative",
          mentionsMe
            ? "border-l-2 border-highlight-border bg-highlight-bg"
            : "hover:bg-surface-subtle focus-within:bg-surface-subtle",
        )}
      >
        {compact ? (
          <CompactRow message={message} timeZone={timeZone} content={content} />
        ) : (
          <FullRow message={message} timeZone={timeZone} content={content} />
        )}
        {status === "sent" && !isEditing && (
          <MessageActions message={message} onEdit={edit?.start} onDeleted={edit?.onDeleted} />
        )}
      </div>
    </li>
  );
}

type RowProps = { message: Message; timeZone: string; content?: React.ReactNode };

// "Não foi possível enviar." com "Tentar de novo" e "Descartar" (22:12030).
function SendFailure({ onRetry, onDiscard }: { onRetry?: () => void; onDiscard?: () => void }) {
  const action = buttonVariants({ variant: "link", className: "text-small" });
  return (
    <div className="flex flex-wrap items-center gap-x-2 pt-1 text-small">
      <span role="alert" className="flex items-center gap-2 text-danger-fg">
        <CircleAlert size={16} aria-hidden />
        Não foi possível enviar.
      </span>
      <button type="button" onClick={onRetry} className={action}>
        Tentar de novo
      </button>
      <button type="button" onClick={onDiscard} className={action}>
        Descartar
      </button>
    </div>
  );
}

function CompactRow({ message, timeZone, content }: RowProps) {
  return (
    <div className="group flex gap-2 px-5 py-1">
      {/* Sem o nome à vista, como no Figma; o leitor de tela ainda ouve de quem é. */}
      <span className="sr-only">{message.author.name}</span>
      <div className="flex w-9 shrink-0 justify-end pt-1">
        <MessageTime
          message={message}
          timeZone={timeZone}
          className="opacity-0 group-hover:opacity-100 group-focus-visible/history:opacity-100"
        />
      </div>
      <div className="min-w-0 flex-1">{content}</div>
    </div>
  );
}

function FullRow({ message, timeZone, content }: RowProps) {
  return (
    <div className="mt-2 flex gap-2 px-5 py-1">
      <div className="flex w-9 shrink-0 justify-end">
        {/* Fora da ordem do teclado: o nome, logo ao lado, já abre o mesmo Perfil. */}
        <OpenProfileButton personId={message.author.id} decorative className="self-start">
          <Avatar initials={message.author.initials} seed={message.author.id} />
        </OpenProfileButton>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-baseline gap-2">
          <OpenProfileButton
            personId={message.author.id}
            className="text-body font-black text-fg hover:underline"
          >
            {message.author.name}
          </OpenProfileButton>
          <MessageTime message={message} timeZone={timeZone} />
        </p>
        {content}
      </div>
    </div>
  );
}

function MessageTime({ message, timeZone, className }: RowProps & { className?: string }) {
  return (
    <time dateTime={message.createdAt} className={cn("text-caption text-fg-muted", className)}>
      {formatTime(message.createdAt, timeZone)}
    </time>
  );
}
