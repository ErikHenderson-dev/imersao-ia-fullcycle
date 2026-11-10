"use client";

import { useCallback, useRef, useState } from "react";
import { sendMessage } from "@/app/actions/send-message";
import type { Message, MessageAuthor, SendMessageResult } from "@/app/services/chat-api";
import { newClientId } from "@/app/utils/client-id";
import { withoutDelivered } from "@/app/utils/pending-messages";
import { redirectToExpiredSession } from "@/app/utils/return-path";

export type PendingStatus = "sending" | "failed";

export type PendingMessage = Message & { status: PendingStatus };

// Mensagens ainda não gravadas (spec da F02, "Envio"): fora do cache do SWR, na ordem do envio,
// sempre depois das gravadas. Uma fila, feita de uma cadeia de promessas, manda uma por vez, para
// a ordem gravada ser a do envio; uma falha não trava as seguintes. Gravada, a Mensagem sai daqui
// e entra no cache (`onSent`).
export function usePendingMessages(
  conversationId: string,
  author: MessageAuthor,
  onSent: (message: Message) => void,
) {
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const update = useCallback((clientId: string, changes: Partial<PendingMessage>) => {
    setPending((current) =>
      current.map((message) => (message.clientId === clientId ? { ...message, ...changes } : message)),
    );
  }, []);

  const enqueue = useCallback(
    (clientId: string, body: string) => {
      queue.current = queue.current.then(async () => {
        let result: SendMessageResult;
        try {
          result = await sendMessage(conversationId, clientId, body);
        } catch {
          // Rede fora: o Server Action nem respondeu. Vira falha, como os outros erros.
          result = { kind: "failure" };
        }
        if (result.kind === "unauthenticated") return redirectToExpiredSession();
        if (result.kind !== "ok") return update(clientId, { status: "failed" });
        onSent(result.message);
        setPending((current) => current.filter((message) => message.clientId !== clientId));
      });
    },
    [conversationId, onSent, update],
  );

  const send = useCallback(
    (body: string) => {
      const clientId = newClientId();
      setPending((current) => [
        ...current,
        {
          id: `pending-${clientId}`,
          conversationId,
          clientId,
          author,
          body,
          createdAt: new Date().toISOString(),
          editedAt: null,
          status: "sending",
        },
      ]);
      enqueue(clientId, body);
    },
    [conversationId, author, enqueue],
  );

  // Reenvia com o mesmo client_id: a API devolve a já gravada, se o primeiro envio chegou. A hora
  // passa a ser a da nova tentativa.
  const retry = useCallback(
    (message: PendingMessage) => {
      update(message.clientId, { status: "sending", createdAt: new Date().toISOString() });
      enqueue(message.clientId, message.body);
    },
    [update, enqueue],
  );

  const discard = useCallback((clientId: string) => {
    setPending((current) => current.filter((message) => message.clientId !== clientId));
  }, []);

  // A Mensagem gravada que chegou pelo tempo real, talvez antes da resposta do envio.
  const dropDelivered = useCallback((message: Message) => {
    setPending((current) => withoutDelivered(current, message));
  }, []);

  return { pending, send, retry, discard, dropDelivered };
}
