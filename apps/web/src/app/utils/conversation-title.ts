import type { Conversation } from "@/app/services/chat-api";

type TitledConversation = Pick<Conversation, "kind" | "name" | "counterpart">;

// Como a Conversa se chama nos rótulos: "#nome" no Canal e o nome da outra Pessoa na Conversa
// direta (spec da F05, "Conversa direta").
export function conversationTitle(conversation: TitledConversation): string {
  if (conversation.kind === "direct") return conversation.counterpart?.name ?? "";
  return `#${conversation.name}`;
}

// O rótulo da caixa de mensagem: "Mensagem para #nome", "Mensagem para <primeiro nome>" ou, na
// Conversa consigo mesma, "Mensagem para você". Sem a Pessoa da Sessão, a Conversa direta usa o
// primeiro nome.
export function composerLabel(
  conversation: TitledConversation,
  selfId: string | null,
): string {
  if (conversation.kind !== "direct") return `Mensagem para #${conversation.name}`;
  const counterpart = conversation.counterpart;
  if (!counterpart) return "Mensagem";
  if (counterpart.id === selfId) return "Mensagem para você";
  return `Mensagem para ${counterpart.name.split(/\s+/)[0]}`;
}
