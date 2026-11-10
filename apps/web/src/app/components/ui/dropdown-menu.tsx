"use client";

import { DropdownMenu as Primitive } from "radix-ui";
import { cn } from "@/app/utils/cn";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;

// Menu do design system: rounded-card, shadow-2, superfície elevada, camada de diálogos.
// Com `inline`, o menu fica no lugar dele na árvore, e não num portal no fim do body: assim ele
// continua dentro da landmark de onde abriu (o menu da Mensagem, dentro da Conversa).
export function DropdownMenuContent({
  className,
  sideOffset = 8,
  inline = false,
  ...props
}: React.ComponentProps<typeof Primitive.Content> & { inline?: boolean }) {
  const content = (
    <Primitive.Content
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-48 animate-pop-in rounded-card bg-surface-raised py-2 text-fg shadow-2",
        className,
      )}
      {...props}
    />
  );
  return inline ? content : <Primitive.Portal>{content}</Primitive.Portal>;
}

// h-8, destacado com sidebar-active.
export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        "flex min-h-8 cursor-default items-center gap-2 px-4 text-body text-fg outline-none select-none",
        "data-[highlighted]:bg-sidebar-active data-[highlighted]:text-sidebar-on-active",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

// my-2, 1 px.
export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      className={cn("my-2 h-px bg-border-subtle", className)}
      {...props}
    />
  );
}
