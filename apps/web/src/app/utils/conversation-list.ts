import type { Conversation, Unread } from "@/app/services/chat-api";
import { compareNames } from "./name-order";

// A rota do BFF que lê a lista de Conversas.
export const CONVERSATIONS_URL = "/api/conversations";

// O endereço de uma Conversa.
export function conversationHref(conversation: Pick<Conversation, "id">): string {
  return `/conversas/${conversation.id}`;
}

// O endereço de uma Mensagem na Conversa dela (spec da F08, "Abrir a Conversa na Mensagem"): o
// destino do item de Atividade, do Alerta e da notificação do navegador.
export function messageHref(conversationId: string, messageId: string): string {
  return `/conversas/${conversationId}?mensagem=${messageId}`;
}

// A chave do cache da lista de Conversas, por Pessoa: quem entra depois de outra na mesma aba, sem
// recarregar a página, não herda a lista dela. A barra lateral, o cabeçalho da Conversa e o aviso
// de leitura leem e mudam o mesmo cache, o global do SWR.
export function conversationsKey(personId: string): [string, string] {
  return [CONVERSATIONS_URL, personId];
}

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
// "Informar a leitura"). Uma resposta atrasada, com a Última leitura anterior à do cache, não volta
// os números para trás.
export function applyUnread(
  list: readonly Conversation[],
  conversationId: string,
  unread: Unread,
): readonly Conversation[] {
  return list.map((item) =>
    item.id === conversationId && !isOlderRead(unread.lastReadMessageId, item.lastReadMessageId)
      ? { ...item, ...unread }
      : item,
  );
}

function isOlderRead(incoming: string | null, cached: string | null): boolean {
  return cached !== null && (incoming === null || incoming < cached);
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
