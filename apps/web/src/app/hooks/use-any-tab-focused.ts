"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  anyFocusedAnswer,
  TAB_FOCUS_CHANNEL,
  TAB_FOCUS_WAIT_MS,
  type TabFocusMessage,
} from "@/app/utils/tab-presence";

function isThisTabFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

// Se alguma aba do chat neste navegador está em foco, esta ou outra (spec da F08, "Foco entre
// abas"): esta responde na hora; senão, pergunta às outras e espera as respostas um instante.
// Devolve uma função estável, para quem decide na hora de um evento do tempo real.
export function useAnyTabFocused(): () => Promise<boolean> {
  const channel = useRef<BroadcastChannel | null>(null);
  const received = useRef<TabFocusMessage[]>([]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bus = new BroadcastChannel(TAB_FOCUS_CHANNEL);
    channel.current = bus;
    bus.onmessage = ({ data }: MessageEvent<TabFocusMessage>) => {
      if (data.type === "ask") {
        bus.postMessage({ type: "answer", askId: data.askId, isFocused: isThisTabFocused() });
      } else {
        received.current.push(data);
      }
    };
    return () => {
      bus.close();
      channel.current = null;
    };
  }, []);

  return useCallback(async () => {
    if (isThisTabFocused()) return true;
    const bus = channel.current;
    if (!bus) return false;
    const askId = crypto.randomUUID();
    bus.postMessage({ type: "ask", askId });
    await new Promise((resolve) => setTimeout(resolve, TAB_FOCUS_WAIT_MS));
    const answers = received.current;
    received.current = answers.filter((message) => message.type === "answer" && message.askId !== askId);
    // Esta aba pode ter ganhado o foco durante a espera.
    return isThisTabFocused() || anyFocusedAnswer(answers, askId);
  }, []);
}
