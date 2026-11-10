import { RetryButton } from "@/app/components/ui/retry-button";
import { MessageComposer } from "./message-composer";

// "Conversa / Erro ao carregar" (21:4642): a primeira página não carregou. "Tentar de novo"
// renderiza a rota de novo; a caixa de mensagem fica desabilitada até o histórico chegar.
const MESSAGE = "Não foi possível carregar as mensagens desta conversa.";

export function HistoryError({ composerLabel }: { composerLabel?: string }) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5">
        <p className="text-body text-fg">{MESSAGE}</p>
        <RetryButton variant="secondary" announce={MESSAGE} />
      </div>
      <MessageComposer label={composerLabel} disabled />
    </>
  );
}
