"use client";

import { cn } from "@/app/utils/cn";
import { useProfilePanelActions } from "./profile-panel-provider";

type OpenProfileButtonProps = Omit<React.ComponentProps<"button">, "onClick" | "type"> & {
  personId: string;
  // Uma segunda forma de abrir o mesmo Perfil, ao lado de outro botão (o avatar ao lado do nome):
  // fora do teclado e do leitor de tela, e o foco volta ao botão principal da mesma linha.
  decorative?: boolean;
};

const MAIN_BUTTON = "data-profile-button";

// Um botão que abre o painel de perfil de uma Pessoa (spec da F05, "Onde o Perfil abre").
export function OpenProfileButton({
  personId,
  decorative = false,
  className,
  ...props
}: OpenProfileButtonProps) {
  const { openProfile } = useProfilePanelActions();
  return (
    <button
      type="button"
      onClick={(event) => {
        const self = event.currentTarget;
        const main = decorative
          ? self.closest("li")?.querySelector<HTMLElement>(`[${MAIN_BUTTON}]`)
          : self;
        openProfile(personId, main ?? self);
      }}
      className={cn("cursor-pointer rounded-control", className)}
      {...(decorative ? { tabIndex: -1, "aria-hidden": true } : { [MAIN_BUTTON]: "" })}
      {...props}
    />
  );
}
