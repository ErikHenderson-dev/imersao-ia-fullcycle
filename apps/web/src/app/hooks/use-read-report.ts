"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { mutate } from "swr";
import type { Conversation, MarkReadResult, Unread } from "@/app/services/chat-api";
import { applyUnread, conversationsKey } from "@/app/utils/conversation-list";
import { hasUnreadToReport, readReportDelay } from "@/app/utils/read-report";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { useTabFocus } from "./use-tab-focus";

type ReadReport = {
  conversationId: string;
  personId: string;
  // A Mensagem salva mais nova da lista carregada.
  newestSaved: { id: string; authorId: string } | undefined;
  // A Última leitura que a lista de Conversas trouxe ao abrir.
  initialLastReadId: string | null;
  // O histórico em dia com o tempo real: antes disso, a lista pode não ter a Mensagem mais nova.
  isReady: boolean;
};

// Informa a leitura da Conversa aberta com a aba em foco (spec da F07, "Informar a leitura"): ao
// abrir, ao voltar o foco e quando chega Mensagem, no máximo um aviso por intervalo, com a posição
// mais nova do momento do envio. O `ok` aplica os números na lista de Conversas, que mora no cache
// global do SWR; a falha não mostra nada, e a próxima ocasião tenta de novo.
// O aviso pela rota do BFF; a rede caída vira falha.
async function putRead(conversationId: string, messageId: string): Promise<MarkReadResult> {
  try {
    const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    if (response.ok) return { kind: "ok", unread: (await response.json()) as Unread };
    if (response.status === 401) return { kind: "unauthenticated" };
    return { kind: "failure" };
  } catch {
    return { kind: "failure" };
  }
}

export function useReadReport({
  conversationId,
  personId,
  newestSaved,
  initialLastReadId,
  isReady,
}: ReadReport): void {
  const newestSavedId = newestSaved?.id;
  // A própria Mensagem já avançou a Última leitura no envio (spec da F07): não há o que informar.
  const isOwnNewest = newestSaved?.authorId === personId;
  const isFocused = useTabFocus();
  const knownLastRead = useRef(initialLastReadId);
  const lastSentAt = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  const send = useEffectEvent(async () => {
    timer.current = null;
    const messageId = newestSavedId;
    if (!isFocused || !messageId || !hasUnreadToReport(messageId, knownLastRead.current)) return;
    const previous = knownLastRead.current;
    lastSentAt.current = Date.now();
    knownLastRead.current = messageId;
    const result = await putRead(conversationId, messageId);
    if (result.kind === "unauthenticated") return redirectToExpiredSession();
    if (result.kind !== "ok") {
      // A próxima ocasião tenta de novo a partir da posição de antes.
      if (knownLastRead.current === messageId) knownLastRead.current = previous;
      return;
    }
    void mutate(
      conversationsKey(personId),
      (list: readonly Conversation[] | undefined) =>
        list && applyUnread(list, conversationId, result.unread),
      { revalidate: false },
    );
  });

  useEffect(() => {
    if (isOwnNewest && hasUnreadToReport(newestSavedId, knownLastRead.current)) {
      knownLastRead.current = newestSavedId!;
      return;
    }
    if (!isReady || !isFocused || timer.current !== null) return;
    if (!hasUnreadToReport(newestSavedId, knownLastRead.current)) return;
    const delay = readReportDelay(lastSentAt.current, Date.now());
    timer.current = window.setTimeout(() => void send(), delay);
  }, [isReady, isFocused, newestSavedId, isOwnNewest]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
}
