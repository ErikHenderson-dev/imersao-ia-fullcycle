import { Bot } from "lucide-react";
import { cn } from "@/app/utils/cn";

type AgentAvatarProps = {
  // xs, na barra lateral (20, sobre `sidebar-field`); md, no diálogo (36, sobre `sidebar`).
  size?: "xs" | "md";
  className?: string;
};

// AgentAvatar: o robô (`Bot`) distingue Agentes de Pessoas (design system, "Comportamentos
// registrados no Figma"). Decorativo: o nome do Agente fica ao lado.
export function AgentAvatar({ size = "md", className }: AgentAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "xs"
          ? "size-5 rounded-control bg-sidebar-field text-sidebar-fg"
          : "size-9 rounded-item bg-sidebar text-sidebar-fg-strong",
        className,
      )}
    >
      <Bot size={size === "xs" ? 12 : 20} />
    </span>
  );
}
