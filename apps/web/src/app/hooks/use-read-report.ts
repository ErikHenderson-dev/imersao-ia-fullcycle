"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import type { MarkReadResult, Unread } from "@/app/services/chat-api";
import { hasUnreadToReport, readReportDelay } from "@/app/utils/read-report";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { useTabFocus } from "./use-tab-focus";

type ReadReport = {
  conversationId: string;
  personId: string;
  // A Mensagem salva mais nova da lista carregada.
  newestSaved: { id: string; authorId: string } | undefined;
  // A Última leitura da Conversa ao abrir.
  initialLastReadId: string | null;
  // O histórico em dia com o tempo real: antes disso, a lista pode não ter a Mensagem mais nova.
  isReady: boolean;
};

// O aviso pela rota do BFF; a rede caída vira falha. Com `keepalive`, o pedido sobrevive à troca
// de Conversa que desmonta o histórico.
async function putRead(
  conversationId: string,
  messageId: string,
  { keepalive = false }: { keepalive?: boolean } = {},
): Promise<MarkReadResult> {
  try {
    const response = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId }),
      keepalive,
    });
    if (response.ok) return { kind: "ok", unread: (await response.json()) as Unread };
    if (response.status === 401) return { kind: "unauthenticated" };
    return { kind: "failure" };
  } catch {
    return { kind: "failure" };
  }
}

// Informa a leitura da Conversa aberta com a aba em foco (spec da F07, "Informar a leitura"): ao
// abrir, ao voltar o foco e quando chega Mensagem, no máximo um aviso por intervalo, com a posição
// mais nova do momento do envio. Os números da lista de Conversas chegam pelo conversation.unread,
// que o servidor ordena na fila da Conversa, e não pela resposta, que pode chegar depois de um
// evento mais novo; a falha não mostra nada, e a próxima ocasião tenta de novo. Um aviso que
// esperava a vez sai na hora quando a Pessoa deixa a Conversa: ela já viu aquela Mensagem.
export function useReadReport({
  conversationId,
  personId,
  newestSaved,
  initialLastReadId,
  isReady,
}: ReadReport): () => string | null {
  const isFocused = useTabFocus();
  const newestSavedId = newestSaved?.id;
  // A própria Mensagem já avançou a Última leitura no envio (spec da F07): não há o que informar.
  const isOwnNewest = newestSaved?.authorId === personId;
  const knownLastRead = useRef(initialLastReadId);
  const lastSentAt = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  // A posição mais nova, para o aviso que sai ao desmontar.
  const latestId = useRef(newestSavedId);

  const applyResult = (result: MarkReadResult) => {
    if (result.kind === "unauthenticated") void redirectToExpiredSession();
  };

  const send = useEffectEvent(async () => {
    timer.current = null;
    const messageId = newestSavedId;
    if (!isFocused || !messageId || !hasUnreadToReport(messageId, knownLastRead.current)) return;
    const previous = knownLastRead.current;
    lastSentAt.current = Date.now();
    knownLastRead.current = messageId;
    const result = await putRead(conversationId, messageId);
    // A próxima ocasião tenta de novo a partir da posição de antes.
    if (result.kind !== "ok" && knownLastRead.current === messageId) knownLastRead.current = previous;
    applyResult(result);
  });

  useEffect(() => {
    latestId.current = newestSavedId;
    if (isOwnNewest && hasUnreadToReport(newestSavedId, knownLastRead.current)) {
      knownLastRead.current = newestSavedId!;
      return;
    }
    if (!isReady || !isFocused || timer.current !== null) return;
    if (!hasUnreadToReport(newestSavedId, knownLastRead.current)) return;
    timer.current = window.setTimeout(() => void send(), readReportDelay(lastSentAt.current, Date.now()));
  }, [isReady, isFocused, newestSavedId, isOwnNewest]);

  useEffect(
    () => () => {
      if (timer.current === null) return;
      window.clearTimeout(timer.current);
      const messageId = latestId.current;
      if (messageId && hasUnreadToReport(messageId, knownLastRead.current)) {
        void putRead(conversationId, messageId, { keepalive: true }).then(applyResult);
      }
    },
    // A Conversa não muda sem desmontar o histórico (a chave do Suspense é o id dela).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // A Última leitura que o aviso conhece agora: a referência do divisor quando o foco volta.
  return useCallback(() => knownLastRead.current, []);
}
