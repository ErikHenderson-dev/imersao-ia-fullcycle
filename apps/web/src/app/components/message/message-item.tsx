import { CircleAlert } from "lucide-react";
import { OpenProfileButton } from "@/app/components/profile/open-profile-button";
import { Avatar } from "@/app/components/ui/avatar";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/utils/cn";
import type { Message } from "@/app/services/chat-api";
import { formatTime } from "@/app/utils/format-time";
import { DayDivider } from "./day-divider";
import { MessageBody } from "./message-body";

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
};

// Mensagem (MessageItem), no layout completo ou compacto. Os estados "enviando" e "falhou" e a
// barra de ações entram na F02-T05 e na F06.
export function MessageItem({
  message,
  timeZone,
  compact = false,
  dayLabel,
  status = "sent",
  onRetry,
  onDiscard,
}: MessageItemProps) {
  const failed = status === "failed" && (
    <SendFailure onRetry={onRetry} onDiscard={onDiscard} />
  );
  return (
    <li
      data-message-id={message.id}
      data-layout={compact ? "compact" : "full"}
      data-status={status}
      aria-busy={status === "sending" || undefined}
      className={cn("flex flex-col", status === "sending" && "opacity-60")}
    >
      {dayLabel && <DayDivider label={dayLabel} />}
      {compact ? (
        <CompactRow message={message} timeZone={timeZone} extra={failed} />
      ) : (
        <FullRow message={message} timeZone={timeZone} extra={failed} />
      )}
    </li>
  );
}

type RowProps = { message: Message; timeZone: string; extra?: React.ReactNode };

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

function CompactRow({ message, timeZone, extra }: RowProps) {
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
      <div className="min-w-0 flex-1">
        <MessageBody text={message.body} />
        {extra}
      </div>
    </div>
  );
}

function FullRow({ message, timeZone, extra }: RowProps) {
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
        <MessageBody text={message.body} />
        {extra}
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
