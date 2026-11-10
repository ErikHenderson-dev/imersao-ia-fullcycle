import type { Presence } from "chat-events";
import { cn } from "@/app/utils/cn";

export type PresenceBackdrop = "sidebar" | "raised" | "chrome" | "surface";

const BACKDROP: Record<PresenceBackdrop, string> = {
  sidebar: "ring-sidebar",
  raised: "ring-surface-raised",
  chrome: "ring-chrome",
  surface: "ring-surface",
};

const FILL: Record<PresenceBackdrop, string> = {
  sidebar: "bg-sidebar",
  raised: "bg-surface-raised",
  chrome: "bg-chrome",
  surface: "bg-surface",
};

// PresenceDot (design system, Primitivos): cheia é disponível; anel vazado é ausente. Sobre um
// avatar, o anel da cor do fundo (`backdrop`) recorta a bolinha. O texto fica para o leitor de tela.
export function PresenceDot({
  presence,
  backdrop,
  decorative,
  className,
}: {
  presence: Presence;
  backdrop?: PresenceBackdrop;
  // No avatar, a bolinha é decorativa: a Presença em texto fica no painel de perfil, no cabeçalho
  // da Conversa direta e no menu do avatar, sem mudar o nome dos links e das opções.
  decorative?: boolean;
  className?: string;
}) {
  return (
    <span
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": presenceLabel(presence) })}
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-pill",
        presence === "available"
          ? "bg-presence-online"
          : cn("border-2 border-presence-away", backdrop ? FILL[backdrop] : "bg-transparent"),
        backdrop && cn("ring-2", BACKDROP[backdrop]),
        className,
      )}
    />
  );
}

export function presenceLabel(presence: Presence): string {
  return presence === "available" ? "Disponível" : "Ausente";
}
