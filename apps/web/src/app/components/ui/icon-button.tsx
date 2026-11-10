import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/app/utils/cn";
import { Tooltip } from "./tooltip";

const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-control transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      tone: {
        default: "text-fg-muted hover:bg-surface-subtle hover:text-fg",
        sidebar: "text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-fg-strong",
        primary: "bg-primary text-on-primary hover:bg-primary-hover",
      },
      size: {
        sm: "size-7",
        md: "size-9",
      },
    },
    defaultVariants: { tone: "default", size: "md" },
  },
);

type IconButtonProps = Omit<React.ComponentProps<"button">, "children"> &
  VariantProps<typeof iconButtonVariants> & {
    icon: LucideIcon;
    // Obrigatório: vira o nome acessível e a dica (design system, "IconButton").
    label: string;
    // A dica do design system (Tooltip, ao passar o mouse e ao focar) no lugar do title nativo.
    hasTooltip?: boolean;
  };

export function IconButton({
  icon: Icon,
  label,
  tone,
  size,
  className,
  type = "button",
  hasTooltip = false,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      title={hasTooltip ? undefined : label}
      className={cn(iconButtonVariants({ tone, size }), className)}
      {...props}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
  return hasTooltip ? <Tooltip label={label}>{button}</Tooltip> : button;
}
