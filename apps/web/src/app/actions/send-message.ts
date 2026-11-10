"use server";

import isUUID from "validator/lib/isUUID";
import {
  sendMessage as sendMessageToChat,
  type SendMessageResult,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { messageBodyToSave } from "@/app/utils/message-text";

// Envio de Mensagem (spec da F02, "Envio"): valida o texto como a API e grava pelo service.
export async function sendMessage(
  conversationId: string,
  clientId: string,
  body: string,
): Promise<SendMessageResult> {
  const text = messageBodyToSave(body);
  if (
    typeof conversationId !== "string" ||
    typeof clientId !== "string" ||
    !isUUID(clientId) ||
    text === null
  ) {
    return { kind: "invalid" };
  }
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  return sendMessageToChat(token, conversationId, { clientId, body: text });
}
