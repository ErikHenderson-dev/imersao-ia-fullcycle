"use server";

import { saveTheme as saveThemeInChat, type SaveThemeResult } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { writeThemeCookie } from "@/app/services/theme-cookie";
import { isTheme } from "@/app/utils/theme";

// Grava o tema na Pessoa e o espelha no cookie (spec da F09, "BFF"; LLD, "Cliente", "Tema").
export async function saveTheme(theme: unknown): Promise<SaveThemeResult> {
  if (!isTheme(theme)) return { kind: "invalid" };
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  const result = await saveThemeInChat(token, theme);
  if (result.kind === "ok") await writeThemeCookie(theme);
  return result;
}
