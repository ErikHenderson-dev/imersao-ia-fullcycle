import type { Message, Report } from "@/app/services/chat-api";

const KB = 1024;
const MB = 1024 * KB;
const ONE_DECIMAL = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// O tamanho do PDF no ReportCard (spec da F14, "Cliente (web)"): KB abaixo de 1 MB e MB a partir
// dele, com uma casa e vírgula decimal.
export function formatReportSize(bytes: number): string {
  const [value, unit] = bytes < MB ? [bytes / KB, "KB"] : [bytes / MB, "MB"];
  return `${ONE_DECIMAL.format(value)} ${unit}`;
}

// O PDF que a Mensagem mostra no cartão: só a do Agente, não bloqueada, que traz o relatório. Na
// Resposta bloqueada, a API já manda `report` nulo; a conferência aqui não depende disso.
export function reportOf(message: Pick<Message, "author" | "blocked" | "report">): Report | null {
  if (message.author.kind !== "bot" || message.blocked) return null;
  return message.report;
}

// A rota do BFF que baixa o PDF da Mensagem.
export function reportHref(messageId: string): string {
  return `/api/messages/${encodeURIComponent(messageId)}/report`;
}
