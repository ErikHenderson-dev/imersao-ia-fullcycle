import type { NotificationKind } from "@/app/services/chat-api";

// Quanto tempo o Alerta fica na tela (LLD, "Valores de regra", "Duração do Alerta").
export const ALERT_DURATION_MS = 8_000;

export type NotificationDestination = "none" | "alert" | "browser";

// Para onde vai uma Mensagem que chega (spec da F08, "Alerta e notificação do navegador"): sem ser
// Notificação, a lugar nenhum; com a aba em foco e a Conversa dela aberta, também não, porque a
// Pessoa já a vê; com a aba em foco e outra tela, Alerta; sem nenhuma aba do chat em foco, ao
// navegador, se a opção estiver ligada com a permissão dada; com outra aba em foco, a ela.
export function notificationDestination({
  kind,
  isTabFocused,
  isConversationOpen,
  isAnyTabFocused,
  isBrowserEnabled,
}: {
  kind: NotificationKind | null;
  isTabFocused: boolean;
  isConversationOpen: boolean;
  isAnyTabFocused: boolean;
  isBrowserEnabled: boolean;
}): NotificationDestination {
  if (!kind) return "none";
  if (isTabFocused) return isConversationOpen ? "none" : "alert";
  return !isAnyTabFocused && isBrowserEnabled ? "browser" : "none";
}
