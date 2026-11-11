"use client";

import { cn } from "@/app/utils/cn";

export type OpenerButtonProps = Omit<React.ComponentProps<"button">, "onClick" | "type"> & {
  // Uma segunda forma de abrir o mesmo painel ou diálogo, ao lado de outro botão (o avatar ao lado
  // do nome): fora do teclado e do leitor de tela, e o foco volta ao botão principal da mesma linha.
  decorative?: boolean;
};

const MAIN_BUTTON = "data-opener-button";

// Um botão que abre um painel ou diálogo e diz a quem devolver o foco ao fechar: a ele mesmo, ou,
// quando decorativo, ao botão principal da mesma linha (OpenProfileButton, OpenAgentsButton).
export function OpenerButton({
  onOpen,
  decorative = false,
  className,
  ...props
}: OpenerButtonProps & { onOpen: (returnFocusTo: HTMLElement) => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        const self = event.currentTarget;
        const main = decorative
          ? self.closest("li")?.querySelector<HTMLElement>(`[${MAIN_BUTTON}]`)
          : self;
        onOpen(main ?? self);
      }}
      className={cn("cursor-pointer rounded-control", className)}
      {...(decorative ? { tabIndex: -1, "aria-hidden": true } : { [MAIN_BUTTON]: "" })}
      {...props}
    />
  );
}
