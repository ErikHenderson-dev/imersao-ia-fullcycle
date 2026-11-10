"use client";

import { Tooltip } from "@/app/components/ui/tooltip";
import type { Status } from "@/app/services/chat-api";
import { cn } from "@/app/utils/cn";
import { statusEmoji, statusLabel } from "@/app/utils/status-emojis";
import { useKnownStatus } from "./people-provider";

type UserStatusProps = {
  personId: string;
  // O Status do payload, usado antes do primeiro retrato.
  status?: Status | null;
  className?: string;
};

// UserStatus (design system, Entities): o emoji do Status ao lado do nome, com a mensagem no
// Tooltip e no nome acessível (spec da F09, "Componentes novos"). Sem Status, nada.
export function UserStatus({ personId, status: fromPayload, className }: UserStatusProps) {
  const status = useKnownStatus(personId, fromPayload);
  if (!status) return null;
  const { emoji } = statusEmoji(status.emoji);
  const label = statusLabel(status);
  const badge = (
    <span
      role="img"
      aria-label={label}
      // Com mensagem, focável: o Tooltip e o nome acessível a levam ao teclado.
      tabIndex={status.text ? 0 : undefined}
      className={cn("shrink-0 rounded-control font-normal", className)}
    >
      {emoji}
    </span>
  );
  return status.text ? <Tooltip label={status.text}>{badge}</Tooltip> : badge;
}

// O Status por inteiro, no painel de perfil: o emoji e a mensagem, ou o nome do emoji sem ela.
export function UserStatusLine({ personId, status: fromPayload }: UserStatusProps) {
  const status = useKnownStatus(personId, fromPayload);
  if (!status) return null;
  const { emoji, label } = statusEmoji(status.emoji);
  return (
    <p className="flex items-center gap-2 text-body text-fg">
      <span aria-hidden>{emoji}</span>
      <span className="sr-only">Status:</span>
      <span className="min-w-0 break-words">{status.text ?? label}</span>
    </p>
  );
}
