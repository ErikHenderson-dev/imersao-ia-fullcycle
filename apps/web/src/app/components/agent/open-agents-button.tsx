"use client";

import { cn } from "@/app/utils/cn";
import { useOpenAgentsDialog } from "./agents-provider";

type OpenAgentsButtonProps = Omit<React.ComponentProps<"button">, "onClick" | "type"> & {
  // A segunda forma de abrir o diálogo, ao lado do nome (o avatar): fora do teclado e do leitor de
  // tela, e o foco volta ao nome ao fechar, como no OpenProfileButton.
  decorative?: boolean;
};

const MAIN_BUTTON = "data-agents-button";

// Um botão que abre o diálogo "Agentes" (spec da F11, "MessageItem de bot"), como o chip da F10.
export function OpenAgentsButton({ decorative = false, className, ...props }: OpenAgentsButtonProps) {
  const openAgentsDialog = useOpenAgentsDialog();
  return (
    <button
      type="button"
      onClick={(event) => {
        const self = event.currentTarget;
        const main = decorative
          ? self.closest("li")?.querySelector<HTMLElement>(`[${MAIN_BUTTON}]`)
          : self;
        openAgentsDialog?.(main ?? self);
      }}
      className={cn("cursor-pointer rounded-control", className)}
      {...(decorative ? { tabIndex: -1, "aria-hidden": true } : { [MAIN_BUTTON]: "" })}
      {...props}
    />
  );
}
