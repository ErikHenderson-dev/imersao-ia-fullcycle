"use client";

import { Copy, Ellipsis, type LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { IconButton } from "@/app/components/ui/icon-button";
import type { Message } from "@/app/services/chat-api";
import { cn } from "@/app/utils/cn";
import { copyMessageText } from "@/app/utils/copy-message-text";

// Uma ação sobre a Mensagem, que aparece na barra e no menu "Mais ações" (spec da F06, "Barra de
// ações e menu"). As tarefas seguintes acrescentam "Responder", "Editar" e "Apagar" como itens.
export type MessageAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  // "danger" vai separado, no fim do menu, e fica fora da barra.
  tone?: "default" | "danger";
};

type MessageActionsProps = {
  message: Message;
};

// Barra de ações (MessageActions) e menu da Mensagem (MessageMenu), no canto superior direito da
// linha. Aparece ao passar o mouse, com o foco dentro da Mensagem e enquanto o menu está aberto.
export function MessageActions({ message }: MessageActionsProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const actions: MessageAction[] = [
    {
      id: "copy",
      label: "Copiar texto",
      icon: Copy,
      onSelect: () => void copyMessageText(message.body),
    },
  ];
  const regularActions = actions.filter((action) => action.tone !== "danger");
  const dangerActions = actions.filter((action) => action.tone === "danger");

  return (
    <div
      data-message-actions
      className={cn(
        "absolute -top-4 right-5 z-10 flex gap-0.5 rounded-card border border-border bg-surface-raised p-0.5 shadow-1",
        // Escondida sem sair da ordem do teclado: o Tab chega aos botões, e o foco a mostra.
        "pointer-events-none opacity-0",
        "group-hover/message:pointer-events-auto group-hover/message:opacity-100",
        "group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100",
        isMenuOpen && "pointer-events-auto opacity-100",
      )}
    >
      {regularActions.map((action) => (
        <IconButton
          key={action.id}
          icon={action.icon}
          label={action.label}
          size="sm"
          onClick={action.onSelect}
        />
      ))}
      {/* Sem modal: o menu não esconde o resto da página dos leitores de tela com aria-hidden, que
          deixaria controles focáveis escondidos. */}
      <DropdownMenu open={isMenuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton icon={Ellipsis} label="Mais ações" size="sm" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" inline>
          {regularActions.map((action) => (
            <MenuItem key={action.id} action={action} />
          ))}
          {dangerActions.length > 0 && <DropdownMenuSeparator />}
          {dangerActions.map((action) => (
            <MenuItem key={action.id} action={action} />
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MenuItem({ action }: { action: MessageAction }) {
  const Icon = action.icon;
  return (
    <DropdownMenuItem
      onSelect={action.onSelect}
      className={cn(action.tone === "danger" && "text-danger-fg")}
    >
      <Icon size={16} aria-hidden />
      {action.label}
    </DropdownMenuItem>
  );
}
