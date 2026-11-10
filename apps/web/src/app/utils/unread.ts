import type { Conversation } from "@/app/services/chat-api";

// O contador mostra até 99; acima disso, "99+" (design system, CountBadge). A API já para as
// contagens em 100.
const COUNT_DISPLAY_LIMIT = 99;

export function formatCount(count: number): string {
  return count > COUNT_DISPLAY_LIMIT ? `${COUNT_DISPLAY_LIMIT}+` : String(count);
}

// O que a linha da barra lateral exibe de uma Conversa (spec da F07, "Lista de Conversas e barra
// lateral"): o negrito quando há Não lidas; o contador, que no Canal é o número de Menções e na
// Conversa direta o de Não lidas, porque toda Mensagem dela é para a Pessoa; e o rótulo do leitor
// de tela, com o nome e o que há de novo. O `suffix` é o que vem depois do nome, escrito só para o
// leitor de tela, para o nome visível continuar no começo do nome acessível.
export type UnreadDisplay = { isUnread: boolean; count: number; label: string; suffix: string };

export function unreadDisplay(conversation: Conversation): UnreadDisplay {
  const isDirect = conversation.kind === "direct";
  const name = isDirect ? (conversation.counterpart?.name ?? "") : conversation.name;
  const isUnread = conversation.unreadCount > 0;
  const count = isDirect ? conversation.unreadCount : conversation.mentionCount;
  const suffix = rowSuffix(isDirect, isUnread, count);
  return { isUnread, count, label: `${name}${suffix}`, suffix };
}

function rowSuffix(isDirect: boolean, isUnread: boolean, count: number): string {
  if (!isUnread) return "";
  if (isDirect) {
    return `, ${spoken(count)} ${count === 1 ? "mensagem não lida" : "mensagens não lidas"}`;
  }
  if (count === 0) return ", não lidas";
  return `, não lidas, ${spoken(count)} ${count === 1 ? "menção" : "menções"}`;
}

// O número como o leitor de tela o diz: "mais de 99" no lugar do "99+".
function spoken(count: number): string {
  return count > COUNT_DISPLAY_LIMIT ? `mais de ${COUNT_DISPLAY_LIMIT}` : String(count);
}
