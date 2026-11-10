"use client";

import { type RefObject, useEffect } from "react";

// A variável CSS com a altura do campo de envio, que o Toaster soma ao afastamento do fundo: os
// toasts, e o Alerta da F08, ficam acima do campo mesmo quando ele cresce com várias linhas. Sem
// campo de envio na tela, a variável sai e os toasts voltam para perto do fundo.
export const COMPOSER_OFFSET_VAR = "--composer-offset";

export function useComposerOffset(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty(COMPOSER_OFFSET_VAR, `${element.offsetHeight}px`);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(COMPOSER_OFFSET_VAR);
    };
  }, [ref]);
}
