"use client";

import { OpenerButton, type OpenerButtonProps } from "@/app/components/ui/opener-button";
import { useOpenAgentsDialog } from "./agents-provider";

// Um botão que abre o diálogo "Agentes" (spec da F11, "MessageItem de bot"), como o chip da F10.
export function OpenAgentsButton(props: OpenerButtonProps) {
  const openAgentsDialog = useOpenAgentsDialog();
  return <OpenerButton onOpen={(returnFocusTo) => openAgentsDialog?.(returnFocusTo)} {...props} />;
}
