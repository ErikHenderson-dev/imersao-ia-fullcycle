"use server";

import { redirect } from "next/navigation";
import { login as loginToChat } from "@/app/services/chat-api";
import { writeSessionCookie } from "@/app/services/session-cookie";
import { writeThemeCookie } from "@/app/services/theme-cookie";
import {
  hasErrors,
  validateLogin,
  type LoginFieldErrors,
} from "@/app/utils/login-validation";
import { writeLoginFeedback } from "@/app/services/login-feedback";
import { loginPath, safeReturnPath } from "@/app/utils/return-path";

export type LoginState =
  | { status: "idle" }
  | { status: "invalid_input"; fieldErrors: LoginFieldErrors }
  | { status: "invalid_credentials" }
  | { status: "too_many_attempts" }
  | { status: "failure" };

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fieldErrors = validateLogin({ email, password });
  if (hasErrors(fieldErrors)) {
    return { status: "invalid_input", fieldErrors };
  }

  const result = await loginToChat(email, password);
  if (result.kind === "invalid_credentials") {
    return { status: "invalid_credentials" };
  }
  if (result.kind === "too_many_attempts") {
    return { status: "too_many_attempts" };
  }
  if (result.kind === "failure") {
    return { status: "failure" };
  }

  await writeSessionCookie(result.token);
  // O navegador novo já abre no tema da Pessoa (spec da F09, "Cliente", "Tema").
  await writeThemeCookie(result.person.theme);
  redirect(safeReturnPath(formData.get("para")));
}

// O mesmo login, como ação nativa do <form>: funciona antes da hidratação. O login certo
// redireciona; nos outros casos a página volta a "Entrar", e o resultado vai num cookie de vida
// curta para o formulário mostrar a mensagem.
export async function submitLogin(formData: FormData): Promise<void> {
  const state = await login({ status: "idle" }, formData);
  await writeLoginFeedback(state);
  redirect(loginPath(formData.get("para")));
}
