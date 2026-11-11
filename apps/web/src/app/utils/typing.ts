// Regras do "digitando" no cliente (LLD, "Estados e regras", "Digitando").

// Intervalo mínimo entre dois avisos de quem digita (LLD, "Valores e configuração").
export const TYPING_ANNOUNCE_INTERVAL_MS = 3_000;

// Quanto tempo o nome fica na tela sem novo aviso (LLD, "Valores e configuração").
export const TYPING_EXPIRY_MS = 5_000;

export type TypingAnnouncement = "start" | "stop" | null;

// O que avisar quando o texto da caixa muda: começou (texto não vazio, sem aviso recente), parou
// (texto vazio depois de ter avisado) ou nada.
export function shouldAnnounce(
  text: string,
  lastAnnouncedAt: number | null,
  now: number,
): TypingAnnouncement {
  if (text.trim() === "") return lastAnnouncedAt === null ? null : "stop";
  if (lastAnnouncedAt === null || now - lastAnnouncedAt >= TYPING_ANNOUNCE_INTERVAL_MS) {
    return "start";
  }
  return null;
}

export type Typer = { id: string; name: string };

// Acrescenta quem digita no fim, ou mantém o lugar de quem já estava: a ordem é a de chegada.
export function addTyper(typers: readonly Typer[], typer: Typer): readonly Typer[] {
  return typers.some((existing) => existing.id === typer.id) ? typers : [...typers, typer];
}

export function removeTyper(typers: readonly Typer[], typerId: string): readonly Typer[] {
  return typers.some((existing) => existing.id === typerId)
    ? typers.filter((existing) => existing.id !== typerId)
    : typers;
}

// O texto da linha do "digitando", vazio sem ninguém.
export function typingLabel(typers: readonly Typer[]): string {
  if (typers.length === 0) return "";
  if (typers.length === 1) return `${typers[0].name} está digitando…`;
  if (typers.length === 2) return `${typers[0].name} e ${typers[1].name} estão digitando…`;
  return "Várias pessoas estão digitando…";
}
