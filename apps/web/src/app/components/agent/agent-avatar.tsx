import { Bot } from "lucide-react";
import { cn } from "@/app/utils/cn";

type AgentAvatarProps = {
  // xs (20) ou md (36), como no component set AgentAvatar do Figma.
  size?: "xs" | "md";
  // field, sobre a barra lateral (`sidebar-field`); default, sobre `sidebar`.
  surface?: "field" | "default";
  className?: string;
};

// AgentAvatar: o robô (`Bot`) distingue Agentes de Pessoas (design system, "Comportamentos
// registrados no Figma"). Decorativo: o nome do Agente fica ao lado.
export function AgentAvatar({ size = "md", surface = "default", className }: AgentAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "xs" ? "size-5 rounded-control" : "size-9 rounded-item",
        surface === "field"
          ? "bg-sidebar-field text-sidebar-fg"
          : "bg-sidebar text-sidebar-fg-strong",
        className,
      )}
    >
      <Bot size={size === "xs" ? 12 : 20} />
    </span>
  );
}
