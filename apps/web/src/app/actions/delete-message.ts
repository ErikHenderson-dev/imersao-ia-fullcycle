"use server";

import {
  deleteMessage as deleteMessageInChat,
  type DeleteMessageResult,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Apagar a própria Mensagem (spec da F06, "BFF").
export async function deleteMessage(
  conversationId: string,
  messageId: string,
): Promise<DeleteMessageResult> {
  if (typeof conversationId !== "string" || typeof messageId !== "string") {
    return { kind: "not_found" };
  }
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  return deleteMessageInChat(token, conversationId, messageId);
}
