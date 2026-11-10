"use client";

import { Tooltip as Primitive } from "radix-ui";

// Atraso da dica (design system, "Tooltip").
const TOOLTIP_DELAY_MS = 400;

type TooltipProps = {
  label: string;
  children: React.ReactElement;
  side?: React.ComponentProps<typeof Primitive.Content>["side"];
};

// Dica de um controle, ao passar o mouse ou focar. O nome acessível continua no próprio controle;
// a dica só repete o rótulo para quem vê. Cada dica traz o próprio Provider, para funcionar em
// qualquer tela, inclusive fora do layout das telas logadas.
export function Tooltip({ label, children, side = "top" }: TooltipProps) {
  return (
    <Primitive.Provider delayDuration={TOOLTIP_DELAY_MS}>
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          side={side}
          sideOffset={6}
          className="z-50 animate-pop-in rounded-item bg-fg px-2 py-1 text-caption font-bold text-fg-inverse shadow-2"
        >
          {label}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
    </Primitive.Provider>
  );
}
