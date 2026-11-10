"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { mutate } from "swr";
import { markConversationRead } from "@/app/actions/mark-conversation-read";
import { conversationsKey } from "@/app/components/workspace-nav/conversation-list";
import type { Conversation } from "@/app/services/chat-api";
import { applyUnread } from "@/app/utils/conversation-list";
import {
  hasUnreadToReport,
  READ_REPORT_INTERVAL_MS,
  readReportDelay,
} from "@/app/utils/read-report";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { useTabFocus } from "./use-tab-focus";

type ReadReport = {
  conversationId: string;
  personId: string;
  // O id da Mensagem salva mais nova da lista carregada.
  newestSavedId: string | undefined;
  // A Última leitura que a lista de Conversas trouxe ao abrir.
  initialLastReadId: string | null;
  // O histórico em dia com o tempo real: antes disso, a lista pode não ter a Mensagem mais nova.
  isReady: boolean;
};

// Informa a leitura da Conversa aberta com a aba em foco (spec da F07, "Informar a leitura"): ao
// abrir, ao voltar o foco e quando chega Mensagem, no máximo um aviso por intervalo, com a posição
// mais nova do momento do envio. O `ok` aplica os números na lista de Conversas, que mora no cache
// global do SWR; a falha não mostra nada, e a próxima ocasião tenta de novo.
export function useReadReport({
  conversationId,
  personId,
  newestSavedId,
  initialLastReadId,
  isReady,
}: ReadReport): void {
  const isFocused = useTabFocus();
  const knownLastRead = useRef(initialLastReadId);
  const lastSentAt = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  const send = useEffectEvent(async () => {
    timer.current = null;
    if (!isFocused || !hasUnreadToReport(newestSavedId, knownLastRead.current)) return;
    const messageId = newestSavedId!;
    const previous = knownLastRead.current;
    lastSentAt.current = Date.now();
    knownLastRead.current = messageId;
    const result = await markConversationRead(conversationId, messageId);
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
    if (!isReady || !isFocused || timer.current !== null) return;
    if (!hasUnreadToReport(newestSavedId, knownLastRead.current)) return;
    const delay = readReportDelay(lastSentAt.current, Date.now(), READ_REPORT_INTERVAL_MS);
    timer.current = window.setTimeout(() => void send(), delay);
  }, [isReady, isFocused, newestSavedId]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
}
