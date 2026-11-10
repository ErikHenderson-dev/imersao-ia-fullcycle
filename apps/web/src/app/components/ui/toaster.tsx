"use client";

import { Toaster as Sonner } from "sonner";

// Toasts do design system (design system, "Toast"): Sonner no canto inferior direito, com botão de
// fechar e as cores do tema pelos tokens. O afastamento do fundo deixa os toasts acima do campo de
// envio, sem cobri-lo (PRD da F08, história 1; "Portas / Toast de atividade").
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      offset={{ bottom: "7rem", right: "2rem" }}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-card !border !border-border-subtle !bg-surface-raised !text-fg !shadow-2 !text-body",
          closeButton: "!border-border-subtle !bg-surface-raised !text-fg-muted",
          title: "!text-body !font-normal !text-fg",
          description: "!text-body !text-fg-muted line-clamp-2",
          actionButton: "!h-6 !rounded-control !bg-fg !px-2 !text-small !text-fg-inverse",
          error: "[&_[data-icon]]:!text-danger",
          success: "[&_[data-icon]]:!text-success",
        },
      }}
    />
  );
}
