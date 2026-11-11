"use client";

import { OpenerButton, type OpenerButtonProps } from "@/app/components/ui/opener-button";
import { useProfilePanelActions } from "./profile-panel-provider";

// Um botão que abre o painel de perfil de uma Pessoa (spec da F05, "Onde o Perfil abre").
export function OpenProfileButton({ personId, ...props }: OpenerButtonProps & { personId: string }) {
  const { openProfile } = useProfilePanelActions();
  return <OpenerButton onOpen={(returnFocusTo) => openProfile(personId, returnFocusTo)} {...props} />;
}
