"use server";

import {
  editMessage as editMessageInChat,
  type EditMessageResult,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { codePointLength, MESSAGE_MAX_LENGTH } from "@/app/utils/message-text";

// Editar a própria Mensagem (spec da F06, "BFF"): valida o texto como a API e grava pelo service.
export async function editMessage(
  conversationId: string,
  messageId: string,
  body: string,
): Promise<EditMessageResult> {
  const text = typeof body === "string" ? body.trim() : "";
  if (
    typeof conversationId !== "string" ||
    typeof messageId !== "string" ||
    text === "" ||
    codePointLength(text) > MESSAGE_MAX_LENGTH
  ) {
    return { kind: "invalid" };
  }
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  return editMessageInChat(token, conversationId, messageId, text);
}
