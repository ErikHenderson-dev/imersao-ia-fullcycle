"use server";

import { revalidatePath } from "next/cache";
import { updateProfile as updateProfileInChat, type Profile } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { parseProfileFields, type ProfileFieldError } from "@/app/utils/profile-fields";

export type UpdateProfileActionResult =
  | { kind: "ok"; profile: Profile }
  | { kind: "invalid"; errors: ProfileFieldError[] }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// Edita o próprio Perfil (spec da F09, "BFF"): valida com as mesmas regras da API, e é essa
// validação que preenche o "Erro de campo". Um 400 da API que escape dela vira o erro geral.
export async function updateProfile(input: {
  name: unknown;
  title: unknown;
  phone: unknown;
}): Promise<UpdateProfileActionResult> {
  const parsed = parseProfileFields(input ?? {});
  if (parsed.kind === "invalid") return parsed;
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  const result = await updateProfileInChat(token, parsed.fields);
  // O Rail e o menu do avatar, renderizados no servidor, passam a ter o nome novo.
  if (result.kind === "ok") revalidatePath("/", "layout");
  return result;
}
