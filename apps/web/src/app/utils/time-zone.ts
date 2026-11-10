import { DEFAULT_TIME_ZONE, timeFormatter } from "./format-time";

// Cookie de fuso (LLD, "Cliente", "Cookies do cliente"): o fuso IANA do navegador.
export const TIME_ZONE_COOKIE = "fc_tz";

// Um fuso IANA que o navegador e o Node reconhecem. Valida montando o formatador de hora, que a
// lista vai usar de qualquer jeito.
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  try {
    timeFormatter(value);
    return true;
  } catch {
    return false;
  }
}

// Fuso válido do cookie, ou o fuso padrão quando ele falta ou não é um fuso IANA.
export function resolveTimeZone(value: string | undefined): string {
  return isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

// O fuso do navegador, ou vazio quando ele não informa.
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
}
