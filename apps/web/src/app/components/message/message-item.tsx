"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { AgentAvatar } from "@/app/components/agent/agent-avatar";
import { AgentTag } from "@/app/components/agent/agent-tag";
import { OpenAgentsButton } from "@/app/components/agent/open-agents-button";
import { OpenProfileButton } from "@/app/components/profile/open-profile-button";
import { PersonAvatar, PersonName } from "@/app/components/people/person-display";
import { UserStatus } from "@/app/components/people/user-status";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/utils/cn";
import type { Message } from "@/app/services/chat-api";
import { formatTime } from "@/app/utils/format-time";
import { DayDivider } from "./day-divider";
import { UnreadDivider } from "./unread-divider";
import { MessageActions } from "./message-actions";
import { MessageBody } from "./message-body";
import { MessageEditor } from "./message-editor";
import { ReplyQuote } from "./reply-quote";

type MessageItemProps = {
  message: Message;
  timeZone: string;
  // Forma compacta (22:7404): sem avatar nem nome, com a hora na calha ao passar o mouse ou com o
  // foco do teclado na área do histórico.
  compact?: boolean;
  // Rótulo do divisor de dia, na primeira Mensagem de cada dia.
  dayLabel?: string;
  // A primeira Não lida da Conversa leva o divisor de novas Mensagens (spec da F07).
  unreadDivider?: boolean;
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
  // Responder citando esta Mensagem (spec da F06, "Citação").
  onReply?: () => void;
  // Por que o envio falhou, quando há um motivo para mostrar.
  failure?: "quote_deleted";
  // Ir até a Mensagem citada, e o destaque de quem chegou por ela (spec da F06, "Ir até a Mensagem
  // citada").
  onGoToQuote?: (messageId: string) => void;
  highlighted?: boolean;
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
  unreadDivider = false,
  status = "sent",
  onRetry,
  onDiscard,
  edit,
  currentPersonId,
  onReply,
  failure,
  onGoToQuote,
  highlighted = false,
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
    <SendFailure
      onRetry={onRetry}
      onDiscard={onDiscard}
      reason={failure}
    />
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
      {message.quote && (
        <ReplyQuote
          quote={message.quote}
          onGoTo={() => onGoToQuote?.(message.quote!.id)}
        />
      )}
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
      {unreadDivider && <UnreadDivider />}
      <div
        data-mentions-me={mentionsMe || undefined}
        data-highlighted={highlighted || undefined}
        className={cn(
          "group/message relative transition-colors duration-300",
          mentionsMe || highlighted
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
          <MessageActions
            message={message}
            onEdit={edit?.start}
            onDeleted={edit?.onDeleted}
            onReply={onReply}
          />
        )}
      </div>
    </li>
  );
}

type RowProps = { message: Message; timeZone: string; content?: React.ReactNode };

// "Não foi possível enviar." com "Tentar de novo" e "Descartar" (22:12030). Com a Citação apagada antes
// do envio, o motivo vem junto (spec da F06, "Citação").
function SendFailure({
  onRetry,
  onDiscard,
  reason,
}: {
  onRetry?: () => void;
  onDiscard?: () => void;
  reason?: string;
}) {
  const action = buttonVariants({ variant: "link", className: "text-small" });
  return (
    <div className="flex flex-wrap items-center gap-x-2 pt-1 text-small">
      <span role="alert" className="flex items-center gap-2 text-danger-fg">
        <CircleAlert size={16} aria-hidden />
        {reason === "quote_deleted"
          ? "Não foi possível enviar: a mensagem citada foi apagada."
          : "Não foi possível enviar."}
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
  const isBot = message.author.kind === "bot";
  return (
    <div className="group flex gap-2 px-5 py-1">
      {/* Sem o nome à vista, como no Figma; o leitor de tela ainda ouve de quem é. */}
      <span className="sr-only">
        {isBot ? (
          `${message.author.name}, Agente`
        ) : (
          <PersonName id={message.author.id} name={message.author.name} />
        )}
      </span>
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
  if (message.author.kind === "bot") {
    return <AgentFullRow message={message} timeZone={timeZone} content={content} />;
  }
  return (
    <div className="mt-2 flex gap-2 px-5 py-1">
      <div className="flex w-9 shrink-0 justify-end">
        {/* Fora da ordem do teclado: o nome, logo ao lado, já abre o mesmo Perfil. */}
        <OpenProfileButton personId={message.author.id} decorative className="self-start">
          <PersonAvatar person={message.author} presenceBackdrop="surface" />
        </OpenProfileButton>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-baseline gap-2">
          <OpenProfileButton
            personId={message.author.id}
            className="text-body font-black text-fg hover:underline"
          >
            <PersonName id={message.author.id} name={message.author.name} />
          </OpenProfileButton>
          <UserStatus personId={message.author.id} />
          <MessageTime message={message} timeZone={timeZone} />
        </p>
        {content}
      </div>
    </div>
  );
}

// A Mensagem do Agente (spec da F11, "MessageItem de bot"): o AgentAvatar e o nome, que abrem o
// diálogo "Agentes", e o AgentTag no lugar do Status.
function AgentFullRow({ message, timeZone, content }: RowProps) {
  return (
    <div className="mt-2 flex gap-2 px-5 py-1">
      <div className="flex w-9 shrink-0 justify-end">
        {/* Fora da ordem do teclado: o nome, logo ao lado, já abre o mesmo diálogo. */}
        <OpenAgentsButton decorative className="self-start">
          <AgentAvatar />
        </OpenAgentsButton>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-baseline gap-2">
          <OpenAgentsButton className="text-body font-black text-fg hover:underline">
            {message.author.name}
          </OpenAgentsButton>
          <AgentTag className="self-center" />
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
