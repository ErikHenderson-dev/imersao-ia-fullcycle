"use server";

import { saveTimeZone as saveTimeZoneInChat, type SaveTimeZoneResult } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { isValidTimeZone } from "@/app/utils/time-zone";

// Grava o fuso do navegador na Pessoa (spec da F05, "BFF"): valida como a API, montando um
// formatador com ele.
export async function saveTimeZone(timeZone: string): Promise<SaveTimeZoneResult> {
  if (!isValidTimeZone(timeZone) || timeZone.length > 64) {
    return { kind: "invalid" };
  }
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  return saveTimeZoneInChat(token, timeZone);
}
