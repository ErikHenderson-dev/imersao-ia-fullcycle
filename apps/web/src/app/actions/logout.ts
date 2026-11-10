"use server";

import { redirect } from "next/navigation";
import { logout as logoutFromChat } from "@/app/services/chat-api";
import {
  deleteSessionCookie,
  readSessionToken,
} from "@/app/services/session-cookie";
import { deleteThemeCookie } from "@/app/services/theme-cookie";

// Sair: apaga a Sessão na API, apaga o cookie e leva a "Entrar". Se a API falhar, o cookie é
// apagado do mesmo jeito (spec da F01, "Menu do avatar").
export async function logout(): Promise<void> {
  const token = await readSessionToken();
  if (token) await logoutFromChat(token);
  await deleteSessionCookie();
  await deleteThemeCookie();
  redirect("/entrar");
}
