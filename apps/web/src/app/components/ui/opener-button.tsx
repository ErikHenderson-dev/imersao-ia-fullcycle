"use client";

import { cn } from "@/app/utils/cn";

export type OpenerButtonProps = Omit<React.ComponentProps<"button">, "onClick" | "type"> & {
  // Uma segunda forma de abrir o mesmo painel ou diálogo, ao lado de outro botão (o avatar ao lado
  // do nome): fora do teclado e do leitor de tela, e o foco volta ao botão principal da mesma linha.
  decorative?: boolean;
};

// Cada tipo de botão marca o principal com o próprio atributo: o decorativo devolve o foco ao do
// mesmo tipo, mesmo com outro tipo antes dele na linha (um chip de Menção no texto).
type OpenerMarker = "data-profile-button" | "data-agents-button";

// Um botão que abre um painel ou diálogo e diz a quem devolver o foco ao fechar: a ele mesmo, ou,
// quando decorativo, ao botão principal da mesma linha (OpenProfileButton, OpenAgentsButton).
export function OpenerButton({
  onOpen,
  marker,
  decorative = false,
  className,
  ...props
}: OpenerButtonProps & { onOpen: (returnFocusTo: HTMLElement) => void; marker: OpenerMarker }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        const self = event.currentTarget;
        const main = decorative
          ? self.closest("li")?.querySelector<HTMLElement>(`[${marker}]`)
          : self;
        onOpen(main ?? self);
      }}
      className={cn("cursor-pointer rounded-control", className)}
      {...(decorative ? { tabIndex: -1, "aria-hidden": true } : { [marker]: "" })}
      {...props}
    />
  );
}
