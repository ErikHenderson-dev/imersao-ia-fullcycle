"use client";

import { useEffect, useRef, useState } from "react";
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
// Tooltip (pelo mouse e pelo foco do teclado) e no nome acessível (spec da F09, "Componentes novos"). Sem Status, nada.
export function UserStatus({ personId, status: fromPayload, className }: UserStatusProps) {
  const status = useKnownStatus(personId, fromPayload);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hasText = Boolean(status?.text);

  // Com mensagem, o foco do teclado mostra o Tooltip (PRD da F09, história 4). Dentro de um link,
  // botão ou opção, o emoji não ganha foco próprio (seria um controle dentro de outro): o Tooltip
  // abre com o foco do controle que o contém; fora deles, o próprio emoji é focável. Dentro de um
  // diálogo, menu ou lista de opções, o foco não abre a dica, que tomaria o Esc deles (ui/tooltip):
  // ali, o nome acessível leva a mensagem.
  useEffect(() => {
    const badge = badgeRef.current;
    if (!badge || !hasText) return;
    const host = badge.parentElement?.closest<HTMLElement>(
      'a, button, [role="option"], [role="button"], [role="link"]',
    );
    const insideLayer = Boolean(badge.closest('[role="dialog"], [role="menu"], [role="listbox"]'));
    setIsStandalone(!host);
    if (insideLayer) return;
    const target = host ?? badge;
    const onFocus = () => setIsFocused(target.matches(":focus-visible"));
    const onBlur = () => setIsFocused(false);
    target.addEventListener("focus", onFocus);
    target.addEventListener("blur", onBlur);
    return () => {
      target.removeEventListener("focus", onFocus);
      target.removeEventListener("blur", onBlur);
    };
  }, [hasText]);

  if (!status) return null;
  const { emoji } = statusEmoji(status.emoji);
  const badge = (
    <span
      ref={badgeRef}
      role="img"
      aria-label={statusLabel(status)}
      tabIndex={isStandalone && hasText ? 0 : undefined}
      className={cn(
        "shrink-0 rounded-control font-normal focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/30",
        className,
      )}
    >
      {emoji}
    </span>
  );
  return status.text ? (
    <Tooltip label={status.text} open={isFocused || isHovered} onOpenChange={setIsHovered}>
      {badge}
    </Tooltip>
  ) : (
    badge
  );
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
