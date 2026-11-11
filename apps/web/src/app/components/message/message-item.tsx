"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { AgentAvatar } from "@/app/components/agent/agent-avatar";
import { AgentTag } from "@/app/components/agent/agent-tag";
import { AgentText } from "@/app/components/agent/agent-text";
import { OpenAgentsButton } from "@/app/components/agent/open-agents-button";
import { QuickReplies } from "@/app/components/agent/quick-replies";
import { OpenProfileButton } from "@/app/components/profile/open-profile-button";
import { PersonAvatar, PersonName } from "@/app/components/people/person-display";
import { UserStatus } from "@/app/components/people/user-status";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/utils/cn";
import type { AgentError, Message } from "@/app/services/chat-api";
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
  // O Agente não recebeu o Pedido desta Mensagem: o aviso ao lado dela, só na aba de quem pediu
  // (spec da F11, "Cliente").
  agentError?: AgentError;
  // O clique numa Resposta pronta da pergunta do Agente: envia o rótulo como Mensagem de quem pediu
  // (spec da F11, "Cliente").
  onQuickReply?: (label: string) => void;
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
  agentError,
  onQuickReply,
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
      {message.author.kind === "bot" ? (
        // O texto do Agente em blocos, sem Menção nem link, e as Respostas prontas da pergunta (spec
        // da F11, "Cliente").
        <>
          <AgentText text={message.body} />
          {message.quickReplies && (
            <QuickReplies
              quickReplies={message.quickReplies}
              currentPersonId={currentPersonId ?? ""}
              onSelect={onQuickReply}
            />
          )}
        </>
      ) : (
        <MessageBody
          text={message.body}
          mentions={message.mentions}
          currentPersonId={currentPersonId}
          edited={message.editedAt}
          timeZone={timeZone}
        />
      )}
      {failed}
      {agentError && <AgentRequestError error={agentError} />}
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

// O erro do Agente ao lado da Mensagem enviada (Conversa / Mensagem / Erro do agente), sem ação: o
// Pedido não volta, e quem pediu menciona de novo.
function AgentRequestError({ error }: { error: AgentError }) {
  return (
    <p role="alert" className="flex items-center gap-2 pt-1 text-small text-danger-fg">
      <CircleAlert size={16} aria-hidden />
      {error.reason === "rate_limited"
        ? "Muitos pedidos em pouco tempo. Tente de novo em um minuto."
        : `O ${error.agentName} não recebeu o pedido. Mencione de novo.`}
    </p>
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

// A linha completa: o avatar e o nome abrem o Perfil da Pessoa, ou o diálogo "Agentes" na Mensagem do
// Agente, que troca o Status pelo AgentTag (spec da F11, "MessageItem de bot"). O avatar fica fora
// da ordem do teclado: o nome, logo ao lado, abre o mesmo.
function FullRow({ message, timeZone, content }: RowProps) {
  const { author } = message;
  const nameClass = "text-body font-black text-fg hover:underline";
  const [avatar, name, badge] =
    author.kind === "bot"
      ? [
          <OpenAgentsButton key="avatar" decorative className="self-start">
            <AgentAvatar />
          </OpenAgentsButton>,
          <OpenAgentsButton key="name" className={nameClass}>
            {author.name}
          </OpenAgentsButton>,
          <AgentTag key="badge" className="self-center" />,
        ]
      : [
          <OpenProfileButton key="avatar" personId={author.id} decorative className="self-start">
            <PersonAvatar person={author} presenceBackdrop="surface" />
          </OpenProfileButton>,
          <OpenProfileButton key="name" personId={author.id} className={nameClass}>
            <PersonName id={author.id} name={author.name} />
          </OpenProfileButton>,
          <UserStatus key="badge" personId={author.id} />,
        ];
  return (
    <div className="mt-2 flex gap-2 px-5 py-1">
      <div className="flex w-9 shrink-0 justify-end">{avatar}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex items-baseline gap-2">
          {name}
          {badge}
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
