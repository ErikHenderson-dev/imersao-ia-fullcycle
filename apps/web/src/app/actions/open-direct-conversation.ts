"use server";

import isUUID from "validator/lib/isUUID";
import {
  openDirectConversation as openDirectConversationInChat,
  type OpenDirectConversationResult,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Abre a Conversa direta com a Pessoa (spec da F05, "BFF"): valida como a API e abre pelo service.
export async function openDirectConversation(
  personId: string,
): Promise<OpenDirectConversationResult> {
  if (typeof personId !== "string" || !isUUID(personId)) return { kind: "invalid" };
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  return openDirectConversationInChat(token, personId);
}
