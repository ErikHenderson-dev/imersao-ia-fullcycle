import type { StatusEmoji } from "chat-events";
import { codePointLength } from "./message-text";
import { STATUS_EMOJIS } from "./status-emojis";

// Espelho, na web, das regras do Perfil da API do chat (spec da F09, "BFF", "Regras
// compartilhadas"; LLD, "Valores de regra", "Tamanho do nome", "Tamanho do cargo" e "Formato do
// telefone", "Tamanho do texto do Status" e "Emojis do Status"). A API continua dona da regra; esta
// preenche o "Erro de campo" do diálogo.
export const NAME_MAX_LENGTH = 80;
export const TITLE_MAX_LENGTH = 80;
export const PHONE_MAX_LENGTH = 30;
export const STATUS_TEXT_MAX_LENGTH = 100;

const PHONE_PATTERN = new RegExp(`^[0-9 +()-]{1,${PHONE_MAX_LENGTH}}$`);
const LINE_BREAK = /[\r\n]/;
// O text do Postgres recusa o U+0000, e a API também (NoNullCharacter).
const NULL_CHARACTER = String.fromCharCode(0);

export type ProfileField = "name" | "title" | "phone" | "statusEmoji" | "statusText";

export type ProfileFieldError = { field: ProfileField; message: string };

// O que o diálogo grava: o nome aparado; o cargo, o telefone e a mensagem de status aparados, ou
// nulos quando vazios; e o emoji, que a mensagem sem emoji ganha como o `speech`, como na API.
export type ProfileFields = {
  name: string;
  title: string | null;
  phone: string | null;
  statusEmoji: StatusEmoji | null;
  statusText: string | null;
};

export type ProfileFieldsResult =
  | { kind: "ok"; fields: ProfileFields }
  | { kind: "invalid"; errors: ProfileFieldError[] };

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// O erro do texto com quebra de linha ou acima do limite; `noun` entra na mensagem.
function singleLineError(value: string, max: number, noun: string): string | null {
  if (value.includes(NULL_CHARACTER)) return `${noun} tem um caractere inválido.`;
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

function isStatusEmoji(value: unknown): value is StatusEmoji {
  return STATUS_EMOJIS.some((item) => item.key === value);
}

// Valida o que o diálogo envia, na ordem dos campos na tela.
export function parseProfileFields(input: {
  name: unknown;
  title: unknown;
  phone: unknown;
  statusEmoji: unknown;
  statusText: unknown;
}): ProfileFieldsResult {
  // Os campos de tipo errado: texto onde se espera texto, ou uma chave fora das sete.
  const notText: ProfileField[] = (["name", "title", "phone", "statusText"] as const).filter(
    (field) => typeof input[field] !== "string",
  );
  if (input.statusEmoji !== null && !isStatusEmoji(input.statusEmoji)) {
    notText.push("statusEmoji");
  }
  if (notText.length > 0) {
    return {
      kind: "invalid",
      errors: notText.map((field) => ({ field, message: "Dados inválidos." })),
    };
  }
  const statusText = blankToNull(input.statusText as string);
  const fields: ProfileFields = {
    name: (input.name as string).trim(),
    title: blankToNull(input.title as string),
    phone: blankToNull(input.phone as string),
    statusEmoji: (input.statusEmoji as StatusEmoji | null) ?? (statusText === null ? null : "speech"),
    statusText,
  };
  const errors: ProfileFieldError[] = [];
  const checks: [ProfileField, string | null][] = [
    ["name", nameError(fields.name)],
    ["title", titleError(fields.title)],
    ["phone", phoneError(fields.phone)],
    [
      "statusText",
      fields.statusText === null
        ? null
        : singleLineError(fields.statusText, STATUS_TEXT_MAX_LENGTH, "A mensagem de status"),
    ],
  ];
  for (const [field, message] of checks) {
    if (message) errors.push({ field, message });
  }
  return errors.length > 0 ? { kind: "invalid", errors } : { kind: "ok", fields };
}
