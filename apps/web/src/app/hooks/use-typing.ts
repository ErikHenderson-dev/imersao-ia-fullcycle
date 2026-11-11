"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TypingEvent } from "chat-events";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import {
  addTyper,
  removeTyper,
  shouldAnnounce,
  type Typer,
  TYPING_EXPIRY_MS,
} from "@/app/utils/typing";

// A Conversa aberta no socket da aba e os avisos de quem escreve nela (spec da F03, "Digitando").
// A Conversa é aberta ao montar e a cada conexão, e fechada ao desmontar, depois do aviso de que
// parou. A caixa de mensagem chama `onTextChange` a cada mudança do texto, inclusive o
// esvaziamento depois do envio. A confirmação da abertura e a queda rearmam o aviso: um aviso
// mandado antes de a aba entrar na sala se perde, e o próximo não pode esperar o intervalo.
export function useTypingAnnouncer(conversationId: string) {
  const { socket } = useRealtime();
  const lastAnnouncedAt = useRef<number | null>(null);
  const currentText = useRef("");

  const announce = useCallback(
    (text: string) => {
      const now = Date.now();
      const announcement = shouldAnnounce(text, lastAnnouncedAt.current, now);
      if (announcement === "stop") {
        lastAnnouncedAt.current = null;
        socket?.emit("typing.stop", { conversation_id: conversationId });
      } else if (announcement === "start") {
        lastAnnouncedAt.current = now;
        socket?.emit("typing.start", { conversation_id: conversationId });
      }
    },
    [socket, conversationId],
  );

  useEffect(() => {
    if (!socket) return;
    const rearm = () => {
      lastAnnouncedAt.current = null;
    };
    // Com a Conversa aberta no socket, quem já estava escrevendo avisa de novo: o aviso mandado
    // antes de a aba entrar na sala se perdeu.
    const open = () =>
      socket.emit("conversation.open", { conversation_id: conversationId }, () => {
        rearm();
        announce(currentText.current);
      });
    if (socket.connected) open();
    socket.on("connect", open);
    socket.on("disconnect", rearm);
    return () => {
      socket.off("connect", open);
      socket.off("disconnect", rearm);
      if (lastAnnouncedAt.current !== null) {
        socket.emit("typing.stop", { conversation_id: conversationId });
      }
      rearm();
      socket.emit("conversation.close", { conversation_id: conversationId });
    };
  }, [socket, conversationId, announce]);

  const onTextChange = useCallback(
    (text: string) => {
      currentText.current = text;
      announce(text);
    },
    [announce],
  );

  return { onTextChange };
}

// Quem está digitando na Conversa, Pessoa ou Agente (spec da F11, "Cliente"), em ordem de chegada.
// Cada aviso (re)arma o prazo da `expiração do digitando`; o aviso de que parou, o prazo vencido ou
// a queda da própria conexão tiram quem digitava.
export function useTypers(conversationId: string): readonly Typer[] {
  const { socket } = useRealtime();
  const [typers, setTypers] = useState<readonly Typer[]>([]);

  useEffect(() => {
    if (!socket) return;
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const remove = (typerId: string) => {
      clearTimeout(pending.get(typerId));
      pending.delete(typerId);
      setTypers((current) => removeTyper(current, typerId));
    };
    const onStart = ({ conversation_id, author }: TypingEvent) => {
      if (conversation_id !== conversationId) return;
      clearTimeout(pending.get(author.id));
      pending.set(author.id, setTimeout(() => remove(author.id), TYPING_EXPIRY_MS));
      setTypers((current) => addTyper(current, { id: author.id, name: author.name }));
    };
    const onStop = ({ conversation_id, author }: TypingEvent) => {
      if (conversation_id === conversationId) remove(author.id);
    };
    // A queda da própria conexão esvazia a lista: os avisos que faltarem não chegam.
    const clear = () => {
      pending.forEach(clearTimeout);
      pending.clear();
      setTypers([]);
    };
    socket.on("typing.start", onStart);
    socket.on("typing.stop", onStop);
    socket.on("disconnect", clear);
    return () => {
      socket.off("typing.start", onStart);
      socket.off("typing.stop", onStop);
      socket.off("disconnect", clear);
      clear();
    };
  }, [socket, conversationId]);

  return typers;
}
