import type { StatusEmoji } from "chat-events";

// Os sete emojis do Status, com o nome que o leitor de tela ouve (LLD, "Valores de regra", "Emojis
// do Status"). A API guarda só a chave; o Record obriga uma entrada por chave do contrato.
const BY_KEY: Record<StatusEmoji, { emoji: string; label: string }> = {
  speech: { emoji: "💬", label: "Conversando" },
  headphones: { emoji: "🎧", label: "Focado" },
  calendar: { emoji: "📅", label: "Em reunião" },
  meal: { emoji: "🍽️", label: "Almoçando" },
  home: { emoji: "🏠", label: "Trabalhando de casa" },
  vacation: { emoji: "🌴", label: "De férias" },
  sick: { emoji: "🤒", label: "Doente" },
};

// Na ordem do diálogo "Editar perfil".
export const STATUS_EMOJIS: readonly { key: StatusEmoji; emoji: string; label: string }[] = (
  Object.keys(BY_KEY) as StatusEmoji[]
).map((key) => ({ key, ...BY_KEY[key] }));

export function statusEmoji(key: StatusEmoji): { emoji: string; label: string } {
  return BY_KEY[key];
}

// O que o leitor de tela ouve do Status: o nome do emoji e, quando há, a mensagem.
export function statusLabel(status: { emoji: StatusEmoji; text: string | null }): string {
  const { label } = statusEmoji(status.emoji);
  return status.text ? `Status: ${label}, ${status.text}` : `Status: ${label}`;
}
