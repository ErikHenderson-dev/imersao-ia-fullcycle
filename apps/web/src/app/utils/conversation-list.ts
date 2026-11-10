import type { Conversation } from "@/app/services/chat-api";
import { compareNames } from "./name-order";

// A ordem da lista de Conversas, a mesma da API (spec da F05, "Lista de Conversas"): os Canais
// primeiro, pelo nome, e depois as Conversas diretas, pelo nome da outra Pessoa.
export function compareConversations(a: Conversation, b: Conversation): number {
  const directA = a.kind === "direct";
  const directB = b.kind === "direct";
  if (directA !== directB) return directA ? 1 : -1;
  return compareNames(sortName(a), sortName(b));
}

function sortName(conversation: Conversation): string {
  return conversation.kind === "direct" ? (conversation.counterpart?.name ?? "") : conversation.name;
}

// A lista de Conversas com a Última leitura e os números novos de uma Conversa (spec da F07,
// "Informar a leitura").
export function applyUnread(
  list: readonly Conversation[],
  conversationId: string,
  unread: Pick<Conversation, "lastReadMessageId" | "unreadCount" | "mentionCount">,
): readonly Conversation[] {
  return list.map((item) => (item.id === conversationId ? { ...item, ...unread } : item));
}

// A lista de Conversas da barra lateral depois de um conversation.member_added (spec da F04,
// "Lista de Conversas no cliente"): quem acabou de entrar ganha a Conversa, na ordem e sem repetir;
// quem já era Membro só vê a quantidade de Membros mudar.
export function applyMemberAdded(
  list: readonly Conversation[],
  conversation: Conversation,
  personIds: readonly string[],
  selfId: string,
): readonly Conversation[] {
  if (list.some((item) => item.id === conversation.id)) {
    return list.map((item) =>
      item.id === conversation.id ? { ...item, memberCount: conversation.memberCount } : item,
    );
  }
  // Uma Conversa de que a Pessoa não é Membro: a lista fica a mesma, sem nova renderização.
  if (!personIds.includes(selfId)) return list;
  return [...list, conversation].sort(compareConversations);
}
