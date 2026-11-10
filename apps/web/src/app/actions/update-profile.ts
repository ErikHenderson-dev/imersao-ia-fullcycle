"use server";

import {
  updateProfile as updateProfileInChat,
  type UpdateProfileResult,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { parseProfileFields, type ProfileFieldError } from "@/app/utils/profile-fields";

export type UpdateProfileActionResult =
  | UpdateProfileResult
  | { kind: "invalid"; errors: ProfileFieldError[] };

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
  // O nome novo chega ao Rail e ao menu pela camada de Pessoas, sem renderizar o layout de novo
  // (spec da F09, "Cliente").
  return updateProfileInChat(token, parsed.fields);
}
