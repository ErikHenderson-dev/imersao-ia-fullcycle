import { CornerUpLeft } from "lucide-react";
import type { Quote } from "@/app/services/chat-api";

// A Citação acima do texto da Mensagem (ReplyQuote; spec da F06, "Citação"): o nome do autor e o
// começo do texto da original, numa linha, ou "Em resposta a uma mensagem apagada". A não apagada é
// um botão que leva até a original (spec da F06, "Ir até a Mensagem citada").
export function ReplyQuote({ quote, onGoTo }: { quote: Quote; onGoTo?: () => void }) {
  if (quote.deleted) {
    return (
      <p className="flex min-w-0 items-center gap-1 text-caption text-fg-muted">
        <CornerUpLeft size={12} aria-hidden className="shrink-0" />
        <span className="italic">Em resposta a uma mensagem apagada</span>
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onGoTo}
      aria-label={`Ir até a mensagem de ${quote.author.name}: ${quote.body}`}
      className="flex min-w-0 max-w-full items-center gap-1 self-start rounded-item text-left text-caption text-fg-muted hover:text-fg"
    >
      <CornerUpLeft size={12} aria-hidden className="shrink-0" />
      <span className="shrink-0 font-bold text-fg">{quote.author.name}</span>
      <span className="truncate">{quote.body}</span>
    </button>
  );
}
