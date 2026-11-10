import type { Presence } from "chat-events";
import { cn } from "@/app/utils/cn";

export type PresenceBackdrop = "sidebar" | "raised" | "chrome" | "surface";

// O anel que recorta a bolinha do fundo e, no anel vazado, o miolo da cor do fundo.
const BACKDROPS: Record<PresenceBackdrop, { ring: string; fill: string }> = {
  sidebar: { ring: "ring-sidebar", fill: "bg-sidebar" },
  raised: { ring: "ring-surface-raised", fill: "bg-surface-raised" },
  chrome: { ring: "ring-chrome", fill: "bg-chrome" },
  surface: { ring: "ring-surface", fill: "bg-surface" },
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
          : cn("border-2 border-presence-away", backdrop ? BACKDROPS[backdrop].fill : "bg-transparent"),
        backdrop && cn("ring-2", BACKDROPS[backdrop].ring),
        className,
      )}
    />
  );
}

export function presenceLabel(presence: Presence): string {
  return presence === "available" ? "Disponível" : "Ausente";
}

// A Presença em texto, com a bolinha: no painel de perfil e no cabeçalho do menu do avatar.
export function PresenceLine({ presence, className }: { presence: Presence; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-fg", className)}>
      <PresenceDot presence={presence} decorative />
      {presenceLabel(presence)}
    </p>
  );
}
