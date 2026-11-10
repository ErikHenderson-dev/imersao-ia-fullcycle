"use client";

import { useSyncExternalStore } from "react";

// A aba está em foco quando está visível e a janela tem o foco (spec da F07, "Foco da aba"). Sem
// documento (no servidor), não está.
function isTabFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

function subscribe(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("focus", onChange);
  window.addEventListener("blur", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("focus", onChange);
    window.removeEventListener("blur", onChange);
  };
}

export function useTabFocus(): boolean {
  return useSyncExternalStore(subscribe, isTabFocused, () => false);
}
