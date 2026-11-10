import { MessageSkeletonList } from "@/app/components/message/message-skeleton";
import { MessageComposer } from "./message-composer";

// "Conversa / Histórico carregando" (21:1869): os esqueletos no lugar das Mensagens e a caixa de
// mensagem desabilitada até a primeira página chegar.
export function HistoryLoading({ composerLabel }: { composerLabel?: string }) {
  return (
    <>
      <MessageSkeletonList label="Carregando as mensagens" />
      <MessageComposer label={composerLabel} disabled />
    </>
  );
}
