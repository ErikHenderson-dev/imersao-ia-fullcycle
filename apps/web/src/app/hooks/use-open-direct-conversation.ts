"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { openDirectConversation } from "@/app/actions/open-direct-conversation";
import { conversationsKey } from "@/app/components/workspace-nav/conversation-list";
import type { Conversation } from "@/app/services/chat-api";
import { applyMemberAdded } from "@/app/utils/conversation-list";
import { redirectToExpiredSession } from "@/app/utils/return-path";

export type OpenDirectConversationState = "idle" | "opening" | "failed";

// Abre a Conversa direta com uma Pessoa (spec da F05, "Painel de perfil" e "Nova conversa"): a
// Conversa entra na barra lateral na hora, e o member_added que chega depois é ignorado pelo id
// repetido. O estado fica em "opening" até a página trocar, sem um segundo clique.
export function useOpenDirectConversation(sessionPersonId: string) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [state, setState] = useState<OpenDirectConversationState>("idle");
  const pathname = usePathname();
  // Um segundo clique, antes da re-renderização com "opening", não abre outra vez.
  const isOpening = useRef(false);

  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    if (state === "opening") setState("idle");
  }

  // Devolve se a Conversa abriu (a página vai trocar, ou já é a dela).
  async function open(personId: string): Promise<boolean> {
    if (isOpening.current) return false;
    isOpening.current = true;
    setState("opening");
    const result = await openDirectConversation(personId)
      .catch(() => null)
      .finally(() => {
        isOpening.current = false;
      });
    if (result?.kind === "unauthenticated") {
      await redirectToExpiredSession();
      return false;
    }
    if (result?.kind !== "ok") {
      setState("failed");
      return false;
    }
    const { conversation } = result;
    await mutate(
      conversationsKey(sessionPersonId),
      // Sem a lista no cache, nada a inserir: a barra lateral a lê com a Conversa nova.
      (current: readonly Conversation[] | undefined) =>
        current && applyMemberAdded(current, conversation, [sessionPersonId], sessionPersonId),
      { revalidate: false },
    );
    const target = `/conversas/${conversation.id}`;
    // Já na própria Conversa, a página não troca: volta na hora.
    if (target === pathname) setState("idle");
    else router.push(target);
    return true;
  }

  return { state, open };
}
