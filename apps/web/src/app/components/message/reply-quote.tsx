import { CornerUpLeft } from "lucide-react";
import type { Quote } from "@/app/services/chat-api";

// A Citação acima do texto da Mensagem (ReplyQuote; spec da F06, "Citação"): o nome do autor e o
// começo do texto da original, numa linha, ou "Em resposta a uma mensagem apagada".
export function ReplyQuote({ quote }: { quote: Quote }) {
  return (
    <p className="flex min-w-0 items-center gap-1 text-caption text-fg-muted">
      <CornerUpLeft size={12} aria-hidden className="shrink-0" />
      {quote.deleted ? (
        <span className="italic">Em resposta a uma mensagem apagada</span>
      ) : (
        <>
          <span className="sr-only">Em resposta a</span>
          <span className="shrink-0 font-bold text-fg">{quote.author.name}</span>
          <span className="truncate">{quote.body}</span>
        </>
      )}
    </p>
  );
}
