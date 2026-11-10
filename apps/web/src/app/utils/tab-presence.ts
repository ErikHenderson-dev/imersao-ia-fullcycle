// O foco das abas de um navegador, combinado por BroadcastChannel (spec da F08, "Foco entre abas"):
// a aba sem foco pergunta na hora, e as outras respondem com o foco real delas. Sem guardar quem
// estava em foco, uma aba que fechou sem avisar, congelou ou voltou do bfcache não deixa estado
// velho.
export const TAB_FOCUS_CHANNEL = "fc:tab-focus";

// Quanto a aba espera as respostas: as abas do mesmo navegador respondem em poucos milissegundos.
export const TAB_FOCUS_WAIT_MS = 150;

export type TabFocusMessage =
  | { type: "ask"; askId: string }
  | { type: "answer"; askId: string; isFocused: boolean };

// Se alguma das respostas a esta pergunta diz que a aba está em foco.
export function anyFocusedAnswer(messages: readonly TabFocusMessage[], askId: string): boolean {
  return messages.some((message) => message.type === "answer" && message.askId === askId && message.isFocused);
}
