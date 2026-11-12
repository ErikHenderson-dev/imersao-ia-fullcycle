import { ArrowDown } from "lucide-react";
import type { Report } from "@/app/services/chat-api";
import { formatReportSize, reportHref } from "@/app/utils/report-card";

// O cartão do Relatório (ReportCard, Figma 210:1303), abaixo do texto do Agente na entrega: o nome
// do arquivo, o tamanho e "Baixar", um link para a rota do BFF, que confere a Permissão de dados no
// clique (spec da F14, "Cliente (web)"). Sem o atributo `download`: o PDF já chega como anexo pela
// URL assinada, e a página curta do 403 ou do 404 do BFF precisa aparecer. Não aparece na Resposta
// bloqueada.
export function ReportCard({ messageId, report }: { messageId: string; report: Report }) {
  return (
    <div className="flex w-fit max-w-full items-center gap-3 rounded-card border border-border bg-surface p-3">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-item bg-surface-inset text-caption font-bold text-fg-muted"
      >
        PDF
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body font-bold text-fg">{report.fileName}</span>
        <span className="text-small text-fg-muted">{formatReportSize(report.sizeBytes)}</span>
      </span>
      <a
        href={reportHref(messageId)}
        aria-label={`Baixar ${report.fileName}`}
        className="flex shrink-0 items-center gap-1 rounded-control px-2 py-1 text-small font-bold text-link hover:bg-surface-subtle hover:text-link-hover"
      >
        <ArrowDown aria-hidden className="size-4" />
        Baixar
      </a>
    </div>
  );
}
