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
  };

export function IconButton({
  icon: Icon,
  label,
  tone,
  size,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  // A dica do design system, ao passar o mouse e ao focar. As props de um Trigger com asChild que
  // envolva o IconButton chegam aqui e vão para o botão.
  return (
    <Tooltip label={label}>
      <button
        type={type}
        aria-label={label}
        className={cn(iconButtonVariants({ tone, size }), className)}
        {...props}
      >
        <Icon size={18} aria-hidden />
      </button>
    </Tooltip>
  );
}
