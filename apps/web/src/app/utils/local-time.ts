import { timeFormatter } from "./format-time";

// A hora local do Perfil ("14:32 no horário local"), no fuso da Pessoa, e não no do navegador
// (spec da F05, "Painel de perfil").
export function localTimeLabel(timeZone: string, now: Date): string {
  return `${timeFormatter(timeZone).format(now)} no horário local`;
}

// Quanto falta para o próximo minuto começar, para a hora mudar junto com o relógio.
export function msUntilNextMinute(now: Date): number {
  return 60_000 - (now.getTime() % 60_000);
}
