import { Bot, Plug, Plus, Settings2, type LucideIcon } from "lucide-react";
import { CountBadge } from "@/app/components/ui/count-badge";
import { cn } from "@/app/utils/cn";

// Os modos do component set SidebarAction do Figma (16:653), em snake_case (`add-channel` vira
// `add_channel`): as ações de "Canais" e de "Mensagens diretas" e as quatro da seção Agentes, que
// mudam com o papel (design system, "Comportamentos registrados no Figma").
export type SidebarActionVariant = "add_channel" | "new_dm" | "connect" | "add" | "manage" | "view";

type SidebarActionContent = {
  label: string;
  icon: LucideIcon;
  // O quadro do ícone: 16 px em "Adicionar canal" e 20 px nos outros modos, como no desenho.
  tile: "sm" | "md";
};

const SIDEBAR_ACTIONS: Record<SidebarActionVariant, SidebarActionContent> = {
  add_channel: { label: "Adicionar canal", icon: Plus, tile: "sm" },
  new_dm: { label: "Nova conversa", icon: Plus, tile: "md" },
  connect: { label: "Conectar agentes", icon: Plug, tile: "md" },
  add: { label: "Adicionar agente", icon: Plus, tile: "md" },
  manage: { label: "Gerenciar agentes", icon: Settings2, tile: "md" },
  view: { label: "Ver agentes", icon: Bot, tile: "md" },
};

type SidebarActionProps = Omit<React.ComponentProps<"button">, "children"> & {
  variant: SidebarActionVariant;
  // O CountBadge no fim da linha, que some em zero, e o que ele conta para o leitor de tela: o
  // contador é aria-hidden, e o texto vai dentro do botão, depois do rótulo.
  count?: number;
  countLabel?: string;
};

// Ação no fim de uma seção da barra lateral (SidebarAction): h-7, ou 44 px abaixo de md, com o
// ícone num quadro sobre `sidebar-field`. É um botão nativo que repassa as props e a ref, para
// servir de gatilho de diálogo (`DialogTrigger asChild`). O <li> fica com quem usa.
export function SidebarAction({ variant, count = 0, countLabel, className, ...props }: SidebarActionProps) {
  const { label, icon: Icon, tile } = SIDEBAR_ACTIONS[variant];
  const isStrong = variant === "connect";
  return (
    <button
      type="button"
      className={cn(
        "flex h-11 w-full items-center gap-2 rounded-item px-2 text-body hover:bg-sidebar-hover md:h-7",
        isStrong ? "font-black text-sidebar-fg-strong" : "text-sidebar-fg",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-control bg-sidebar-field",
          tile === "sm" ? "size-4" : "size-5",
        )}
      >
        <Icon size={12} />
      </span>
      {label}
      {count > 0 && countLabel && <span className="sr-only">, {countLabel}</span>}
      <CountBadge count={count} className="ml-auto" />
    </button>
  );
}
