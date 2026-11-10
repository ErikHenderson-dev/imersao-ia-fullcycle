"use client";

import { Copy, CornerUpLeft, Ellipsis, Pencil, Trash2, type LucideIcon } from "lucide-react";
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
import { DeleteMessageDialog } from "./delete-message-dialog";

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
  // Presentes só nas Mensagens da Pessoa logada: "Editar" e "Apagar" (spec da F06, "Barra de ações e
  // menu"). `onDeleted` é chamado quando a Mensagem saiu, para quem lista mover o foco.
  onEdit?: () => void;
  onDeleted?: () => void;
  // Responder citando, em qualquer Mensagem enviada (spec da F06, "Citação").
  onReply?: () => void;
};

// Barra de ações (MessageActions) e menu da Mensagem (MessageMenu), no canto superior direito da
// linha. Aparece ao passar o mouse, com o foco dentro da Mensagem e enquanto o menu está aberto.
export function MessageActions({ message, onEdit, onDeleted, onReply }: MessageActionsProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const actions: MessageAction[] = [
    ...(onReply
      ? [{ id: "reply", label: "Responder", icon: CornerUpLeft, onSelect: onReply }]
      : []),
    {
      id: "copy",
      label: "Copiar texto",
      icon: Copy,
      onSelect: () => void copyMessageText(message.body),
    },
    ...(onEdit ? [{ id: "edit", label: "Editar", icon: Pencil, onSelect: onEdit }] : []),
    ...(onDeleted
      ? [
          {
            id: "delete",
            label: "Apagar",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => setDeleteOpen(true),
          },
        ]
      : []),
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
          data-action={action.id}
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
      {onDeleted && (
        <DeleteMessageDialog
          message={message}
          open={isDeleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={onDeleted}
        />
      )}
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
