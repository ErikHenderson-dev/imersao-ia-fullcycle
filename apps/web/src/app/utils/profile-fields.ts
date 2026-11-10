import { codePointLength } from "./message-text";

// Espelho, na web, das regras do Perfil da API do chat (spec da F09, "BFF", "Regras
// compartilhadas"; LLD, "Valores de regra", "Tamanho do nome", "Tamanho do cargo" e "Formato do
// telefone"). A API continua dona da regra; esta preenche o "Erro de campo" do diálogo.
export const NAME_MAX_LENGTH = 80;
export const TITLE_MAX_LENGTH = 80;
export const PHONE_MAX_LENGTH = 30;

const PHONE_PATTERN = new RegExp(`^[0-9 +()-]{1,${PHONE_MAX_LENGTH}}$`);
const LINE_BREAK = /[\r\n]/;

export type ProfileField = "name" | "title" | "phone";

export type ProfileFieldError = { field: ProfileField; message: string };

// O que o diálogo grava: o nome aparado e o cargo e o telefone aparados, ou nulos quando vazios.
export type ProfileFields = { name: string; title: string | null; phone: string | null };

export type ProfileFieldsResult =
  | { kind: "ok"; fields: ProfileFields }
  | { kind: "invalid"; errors: ProfileFieldError[] };

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// O erro do texto com quebra de linha ou acima do limite; `noun` entra na mensagem.
function singleLineError(value: string, max: number, noun: string): string | null {
  if (LINE_BREAK.test(value)) return `${noun} precisa ficar numa linha só.`;
  if (codePointLength(value) > max) return `${noun} pode ter no máximo ${max} caracteres.`;
  return null;
}

function nameError(name: string): string | null {
  if (name === "") return "Informe seu nome completo.";
  return singleLineError(name, NAME_MAX_LENGTH, "O nome");
}

function titleError(title: string | null): string | null {
  return title === null ? null : singleLineError(title, TITLE_MAX_LENGTH, "O cargo");
}

function phoneError(phone: string | null): string | null {
  if (phone === null || PHONE_PATTERN.test(phone)) return null;
  return `O telefone aceita só dígitos, espaço, +, -, ( e ), até ${PHONE_MAX_LENGTH} caracteres.`;
}

// Valida o que o diálogo envia, na ordem dos campos na tela.
export function parseProfileFields(input: {
  name: unknown;
  title: unknown;
  phone: unknown;
}): ProfileFieldsResult {
  if (
    typeof input.name !== "string" ||
    typeof input.title !== "string" ||
    typeof input.phone !== "string"
  ) {
    return { kind: "invalid", errors: [{ field: "name", message: "Dados inválidos." }] };
  }
  const fields: ProfileFields = {
    name: input.name.trim(),
    title: blankToNull(input.title),
    phone: blankToNull(input.phone),
  };
  const errors: ProfileFieldError[] = [];
  const checks: [ProfileField, string | null][] = [
    ["name", nameError(fields.name)],
    ["title", titleError(fields.title)],
    ["phone", phoneError(fields.phone)],
  ];
  for (const [field, message] of checks) {
    if (message) errors.push({ field, message });
  }
  return errors.length > 0 ? { kind: "invalid", errors } : { kind: "ok", fields };
}
