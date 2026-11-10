"use client";

import { AlertDialog } from "radix-ui";
import { Button } from "./button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  // O que a confirmação mostra entre a descrição e os botões, como o texto da Mensagem.
  children?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  // Enquanto confirma: o botão de confirmar fica ocupado, e nada fecha o diálogo.
  isConfirming?: boolean;
  // A falha da confirmação, mostrada acima dos botões; o botão de confirmar vira "Tentar de novo".
  error?: string | null;
  onCloseAutoFocus?: (event: Event) => void;
};

// ConfirmDialog do design system (docs/design-system.md, "ConfirmDialog"): largura máxima de 448,
// foco em Cancelar e sem fechar pelo clique fora (AlertDialog do Radix). O Esc fecha.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  isConfirming = false,
  error,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !isConfirming && onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-surface-overlay" />
        <AlertDialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 -translate-y-1/2 animate-pop-in flex-col gap-4 rounded-card bg-surface-raised p-6 shadow-3 outline-none"
        >
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="text-heading font-black text-fg">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-body text-fg-muted">
              {description}
            </AlertDialog.Description>
          </div>
          {children}
          {error && (
            <p role="alert" className="text-small text-danger-fg">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={isConfirming}>
                Cancelar
              </Button>
            </AlertDialog.Cancel>
            <Button variant="danger" loading={isConfirming} onClick={onConfirm}>
              {error ? "Tentar de novo" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
