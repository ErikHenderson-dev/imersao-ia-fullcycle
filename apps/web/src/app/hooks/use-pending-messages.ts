"use client";

import { useCallback, useRef, useState } from "react";
import { sendMessage } from "@/app/actions/send-message";
import type { AgentError, Message, MessageAuthor, SendMessageResult } from "@/app/services/chat-api";
import { newClientId } from "@/app/utils/client-id";
import { withoutDelivered } from "@/app/utils/pending-messages";
import { redirectToExpiredSession } from "@/app/utils/return-path";

export type PendingStatus = "sending" | "failed";

// `failure` diz por que o envio falhou, quando há um motivo para mostrar (a Citação apagada).
export type PendingMessage = Message & { status: PendingStatus; failure?: "quote_deleted" };

// Mensagens ainda não gravadas (spec da F02, "Envio"): fora do cache do SWR, na ordem do envio,
// sempre depois das gravadas. Uma fila, feita de uma cadeia de promessas, manda uma por vez, para
// a ordem gravada ser a do envio; uma falha não trava as seguintes. Gravada, a Mensagem sai daqui
// e entra no cache (`onSent`), com o erro do Agente quando ele não recebeu o Pedido dela (spec da F11,
// "Cliente").
export function usePendingMessages(
  conversationId: string,
  author: MessageAuthor,
  onSent: (message: Message, agentError?: AgentError) => void,
) {
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const update = useCallback((clientId: string, changes: Partial<PendingMessage>) => {
    setPending((current) =>
      current.map((message) => (message.clientId === clientId ? { ...message, ...changes } : message)),
    );
  }, []);

  const enqueue = useCallback(
    (clientId: string, body: string, quotedMessageId?: string) => {
      queue.current = queue.current.then(async () => {
        let result: SendMessageResult;
        try {
          result = await sendMessage(conversationId, clientId, body, quotedMessageId);
        } catch {
          // Rede fora: o Server Action nem respondeu. Vira falha, como os outros erros.
          result = { kind: "failure" };
        }
        if (result.kind === "unauthenticated") return redirectToExpiredSession();
        // A Mensagem citada foi apagada antes do envio (spec da F06, "Citação").
        if (result.kind === "quote_not_found") {
          return update(clientId, { status: "failed", failure: "quote_deleted" });
        }
        if (result.kind !== "ok") return update(clientId, { status: "failed" });
        onSent(result.message, result.agentError);
        setPending((current) => current.filter((message) => message.clientId !== clientId));
      });
    },
    [conversationId, onSent, update],
  );

  // `quoted` é a Mensagem citada: a pendente já mostra a Citação com os dados da tela.
  const send = useCallback(
    (body: string, quoted?: Message) => {
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
          mentions: [],
          quote: quoted
            ? {
                id: quoted.id,
                deleted: false,
                author: {
                  kind: quoted.author.kind,
                  id: quoted.author.id,
                  name: quoted.author.name,
                  username: quoted.author.username,
                },
                body: quoted.body,
              }
            : null,
          quickReplies: null,
          status: "sending",
        },
      ]);
      enqueue(clientId, body, quoted?.id);
    },
    [conversationId, author, enqueue],
  );

  // Reenvia com o mesmo client_id: a API devolve a já gravada, se o primeiro envio chegou. A hora
  // passa a ser a da nova tentativa.
  const retry = useCallback(
    (message: PendingMessage) => {
      update(message.clientId, {
        status: "sending",
        failure: undefined,
        createdAt: new Date().toISOString(),
      });
      enqueue(message.clientId, message.body, message.quote?.id);
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
