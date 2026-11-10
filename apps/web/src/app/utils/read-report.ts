// Intervalo do aviso de leitura (LLD, "Valores de regra"): no máximo um aviso por Conversa nele.
export const READ_REPORT_INTERVAL_MS = 1_000;

// Há o que informar quando a Mensagem salva mais nova é posterior à Última leitura conhecida (spec
// da F07, "Informar a leitura"). Os ids são UUID v7 em minúsculas: a ordem do texto é a de criação.
export function hasUnreadToReport(
  newestSavedId: string | undefined,
  lastReadId: string | null,
): boolean {
  if (!newestSavedId) return false;
  return lastReadId === null || newestSavedId > lastReadId;
}

// Quanto esperar antes do próximo aviso: nada no primeiro, e o resto do intervalo desde o último.
export function readReportDelay(
  lastSentAt: number | null,
  now: number,
  interval = READ_REPORT_INTERVAL_MS,
): number {
  if (lastSentAt === null) return 0;
  return Math.max(0, lastSentAt + interval - now);
}
