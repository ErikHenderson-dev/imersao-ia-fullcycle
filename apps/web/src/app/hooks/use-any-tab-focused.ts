"use client";

import { useCallback, useEffect, useRef } from "react";
import { applyTabFocus, TAB_FOCUS_CHANNEL, type TabFocusMessage } from "@/app/utils/tab-presence";
import { useTabFocus } from "./use-tab-focus";

// Se alguma aba do chat neste navegador está em foco, esta ou outra (spec da F08, "Foco entre
// abas"). Devolve uma função estável, para quem decide na hora de um evento do tempo real.
export function useAnyTabFocused(): () => boolean {
  const isTabFocused = useTabFocus();
  const isFocused = useRef(isTabFocused);
  const others = useRef(new Set<string>());
  const channel = useRef<BroadcastChannel | null>(null);
  const tabId = useRef("");

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    tabId.current = crypto.randomUUID();
    const bus = new BroadcastChannel(TAB_FOCUS_CHANNEL);
    channel.current = bus;
    const post = (message: TabFocusMessage) => bus.postMessage(message);
    bus.onmessage = ({ data }: MessageEvent<TabFocusMessage>) => {
      others.current = applyTabFocus(others.current, data);
      // Uma aba que acabou de abrir pergunta: as outras respondem com o próprio foco.
      if (data.type === "hello") post({ type: "focus", tabId: tabId.current, isFocused: isFocused.current });
    };
    post({ type: "hello", tabId: tabId.current });
    post({ type: "focus", tabId: tabId.current, isFocused: isFocused.current });
    const bye = () => post({ type: "bye", tabId: tabId.current });
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      bye();
      bus.close();
      channel.current = null;
    };
  }, []);

  useEffect(() => {
    isFocused.current = isTabFocused;
    channel.current?.postMessage({ type: "focus", tabId: tabId.current, isFocused: isTabFocused });
  }, [isTabFocused]);

  return useCallback(() => isFocused.current || others.current.size > 0, []);
}
