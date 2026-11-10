import type { NotificationKind } from "@/app/services/chat-api";

// Quanto tempo o Alerta fica na tela (LLD, "Valores de regra", "Duração do Alerta").
export const ALERT_DURATION_MS = 8_000;

export type NotificationDestination = "none" | "alert";

// Para onde vai uma Mensagem que chega (spec da F08, "Alerta e notificação do navegador"): sem ser
// Notificação, a lugar nenhum; com a aba em foco e a Conversa dela aberta, também não, porque a
// Pessoa já a vê; com a aba em foco e outra tela, Alerta; sem foco, nada por enquanto (a notificação
// do navegador chega na F08-T06).
export function notificationDestination({
  kind,
  isTabFocused,
  isConversationOpen,
}: {
  kind: NotificationKind | null;
  isTabFocused: boolean;
  isConversationOpen: boolean;
}): NotificationDestination {
  if (!kind || !isTabFocused || isConversationOpen) return "none";
  return "alert";
}
