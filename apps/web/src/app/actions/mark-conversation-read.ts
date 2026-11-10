"use server";

import {
  markConversationRead as markConversationReadInChat,
  type MarkReadResult,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Ler a Conversa até a Mensagem (spec da F07, "BFF").
export async function markConversationRead(
  conversationId: string,
  messageId: string,
): Promise<MarkReadResult> {
  if (typeof conversationId !== "string" || typeof messageId !== "string") {
    return { kind: "invalid" };
  }
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  return markConversationReadInChat(token, conversationId, messageId);
}
