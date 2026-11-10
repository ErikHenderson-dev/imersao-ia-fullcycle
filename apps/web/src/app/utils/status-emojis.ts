import type { StatusEmoji } from "chat-events";

// Os sete emojis do Status, na ordem do diálogo "Editar perfil", com o nome que o leitor de tela
// ouve (LLD, "Valores de regra", "Emojis do Status"). A API guarda só a chave.
export const STATUS_EMOJIS: readonly { key: StatusEmoji; emoji: string; label: string }[] = [
  { key: "speech", emoji: "💬", label: "Conversando" },
  { key: "headphones", emoji: "🎧", label: "Focado" },
  { key: "calendar", emoji: "📅", label: "Em reunião" },
  { key: "meal", emoji: "🍽️", label: "Almoçando" },
  { key: "home", emoji: "🏠", label: "Trabalhando de casa" },
  { key: "vacation", emoji: "🌴", label: "De férias" },
  { key: "sick", emoji: "🤒", label: "Doente" },
];

export function statusEmoji(key: StatusEmoji): { emoji: string; label: string } {
  return STATUS_EMOJIS.find((item) => item.key === key) ?? STATUS_EMOJIS[0];
}

// O que o leitor de tela ouve do Status: o nome do emoji e, quando há, a mensagem.
export function statusLabel(status: { emoji: StatusEmoji; text: string | null }): string {
  const { label } = statusEmoji(status.emoji);
  return status.text ? `Status: ${label}, ${status.text}` : `Status: ${label}`;
}
