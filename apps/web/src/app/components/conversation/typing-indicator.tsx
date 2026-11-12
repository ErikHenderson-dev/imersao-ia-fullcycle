"use client";

import { useKnownNames } from "@/app/components/people/people-provider";
import { useTypers } from "@/app/hooks/use-typing";
import { typingLabel } from "@/app/utils/typing";

// Linha do "digitando" (Figma, "Conversa / Lista / Digitando"): reservada acima da caixa de
// mensagem, com a mesma altura com ou sem texto. Não é região aria-live, para não anunciar cada
// aviso ao leitor de tela (spec da F03, "Telas"). Ela mesma assina os avisos: a lista de Mensagens
// não renderiza de novo a cada um.
export function TypingIndicator({ conversationId }: { conversationId: string }) {
  // Com o nome atual: quem troca o nome enquanto digita aparece com o novo na hora.
  const typers = useKnownNames(useTypers(conversationId));
  return (
    <p className="h-5 shrink-0 truncate px-5 text-caption text-fg-muted">{typingLabel(typers)}</p>
  );
}
