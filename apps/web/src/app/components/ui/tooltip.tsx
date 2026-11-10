"use client";

import { Tooltip as Primitive } from "radix-ui";

// Atraso da dica (design system, "Tooltip").
const TOOLTIP_DELAY_MS = 400;

// Um Provider só, no layout raiz: o atraso vale uma vez, e passar de uma dica para a vizinha não
// espera de novo.
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <Primitive.Provider delayDuration={TOOLTIP_DELAY_MS}>{children}</Primitive.Provider>;
}

// O Esc que só fechou uma dica. O Radix marca esse Esc como tratado (preventDefault), e quem fecha
// com Esc e ignora o que já foi tratado, como o painel de perfil, consulta esta marca para não
// perder o Esc só porque o foco estava num botão com dica.
const tooltipEscapes = new WeakSet<KeyboardEvent>();

export function isTooltipEscape(event: KeyboardEvent): boolean {
  return tooltipEscapes.has(event);
}

type TooltipProps = {
  label: string;
  children: React.ReactElement;
};

// Dica de um controle, ao passar o mouse. O nome acessível continua no próprio controle, e é ele que
// o teclado e o leitor de tela recebem: a dica não abre no foco, porque aberta ela seria a camada
// de cima do Radix e o Esc fecharia só ela, e não o diálogo ou o menu em que o controle está.
export function Tooltip({ label, children }: TooltipProps) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild onFocus={(event) => event.preventDefault()}>
        {children}
      </Primitive.Trigger>
      {/* Sem portal: a dica fica junto do controle, dentro da landmark dele, e o posicionamento
          fixo do Radix a tira do fluxo. */}
      <Primitive.Content
        side="top"
        sideOffset={6}
        onEscapeKeyDown={(event) => tooltipEscapes.add(event)}
        className="z-50 animate-pop-in rounded-item bg-fg px-2 py-1 text-caption font-bold text-fg-inverse shadow-2"
      >
        {label}
      </Primitive.Content>
    </Primitive.Root>
  );
}
