"use server";

import {
  savePresenceChoice as savePresenceChoiceInChat,
  type SavePresenceChoiceResult,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Grava a escolha de presença (spec da F09, "BFF"): valida como a API.
export async function savePresenceChoice(choice: unknown): Promise<SavePresenceChoiceResult> {
  if (choice !== "available" && choice !== "away") return { kind: "invalid" };
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  return savePresenceChoiceInChat(token, choice);
}
