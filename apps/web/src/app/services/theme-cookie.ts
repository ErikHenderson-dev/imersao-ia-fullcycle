import { cookies } from "next/headers";
import { COOKIE_MAX_AGE_SECONDS } from "@/app/utils/client-cookies";
import { THEME_COOKIE, type Theme } from "@/app/utils/theme";

// O espelho do tema da Pessoa no navegador (LLD, "Cliente", "Cookies do cliente", "Tema"): lido pelo
// script do <head>, então sem HttpOnly. Só em Server Functions e Route Handlers.
export async function writeThemeCookie(theme: Theme): Promise<void> {
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function deleteThemeCookie(): Promise<void> {
  (await cookies()).set(THEME_COOKIE, "", { path: "/", sameSite: "lax", maxAge: 0 });
}
