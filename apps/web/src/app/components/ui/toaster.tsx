"use client";

import { Toaster as Sonner } from "sonner";

// Toasts do design system (design system, "Toast"): Sonner no canto inferior direito, com botão de
// fechar e as cores do tema pelos tokens.
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-card !border !border-border-subtle !bg-surface-raised !text-fg !shadow-2 !text-body",
          closeButton: "!border-border-subtle !bg-surface-raised !text-fg-muted",
          error: "[&_[data-icon]]:!text-danger",
          success: "[&_[data-icon]]:!text-success",
        },
      }}
    />
  );
}
