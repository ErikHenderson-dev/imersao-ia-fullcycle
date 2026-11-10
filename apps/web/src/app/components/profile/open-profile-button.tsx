"use client";

import { cn } from "@/app/utils/cn";
import { useProfilePanel } from "./profile-panel-provider";

type OpenProfileButtonProps = Omit<React.ComponentProps<"button">, "onClick" | "type"> & {
  personId: string;
};

// Um botão que abre o painel de perfil de uma Pessoa (spec da F05, "Onde o Perfil abre").
export function OpenProfileButton({ personId, className, ...props }: OpenProfileButtonProps) {
  const { openProfile } = useProfilePanel();
  return (
    <button
      type="button"
      onClick={(event) => openProfile(personId, event.currentTarget)}
      className={cn("cursor-pointer rounded-control", className)}
      {...props}
    />
  );
}
