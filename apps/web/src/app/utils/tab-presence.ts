// O foco das abas de um navegador, combinado por BroadcastChannel (spec da F08, "Foco entre abas"):
// cada aba avisa quando ganha ou perde o foco e quando fecha, e pergunta o estado às outras ao abrir.
export const TAB_FOCUS_CHANNEL = "fc:tab-focus";

export type TabFocusMessage =
  | { type: "focus"; tabId: string; isFocused: boolean }
  | { type: "bye"; tabId: string }
  | { type: "hello"; tabId: string };

// As abas em foco depois de uma mensagem de outra aba. "hello" não muda nada: quem recebe responde
// com o próprio foco.
export function applyTabFocus(focused: ReadonlySet<string>, message: TabFocusMessage): Set<string> {
  const next = new Set(focused);
  if (message.type === "focus" && message.isFocused) next.add(message.tabId);
  else if (message.type === "focus" || message.type === "bye") next.delete(message.tabId);
  return next;
}
