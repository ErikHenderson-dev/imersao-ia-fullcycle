"use server";

import { saveTheme as saveThemeInChat, type SaveThemeResult } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { isTheme } from "@/app/utils/theme";

// Grava o tema na Pessoa (spec da F09, "BFF"); o espelho no cookie é do cliente (LLD, "Cliente",
// "Tema").
export async function saveTheme(theme: unknown): Promise<SaveThemeResult> {
  if (!isTheme(theme)) return { kind: "invalid" };
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  // O cookie fica com o cliente, que já o gravou: gravá-lo aqui faria o Next renderizar o layout de
  // novo a cada troca.
  return saveThemeInChat(token, theme);
}
