"use client";

import { House } from "lucide-react";
import Link from "next/link";
import { useVisibleUnread } from "@/app/hooks/use-visible-unread";
import { hasVisibleUnread } from "@/app/utils/unread";

// O Início do rail, com o ponto `badge` sobre o ícone quando há ao menos uma Conversa Não lida, fora
// a aberta com a aba em foco, e o rótulo que o diz ao leitor de tela (spec da F07, "Título da aba e
// rail").
export function HomeLink({ personId }: { personId: string }) {
  const { conversations, isOpenAndFocused } = useVisibleUnread(personId);
  const hasUnread = hasVisibleUnread(conversations, isOpenAndFocused);
  return (
    <Link
      href="/"
      aria-current="page"
      aria-label={hasUnread ? "Início, há mensagens não lidas" : undefined}
      className="flex w-full flex-col items-center gap-1 rounded-card py-1 text-sidebar-fg"
    >
      <span className="relative flex size-9 items-center justify-center rounded-card bg-sidebar-field">
        <House size={20} aria-hidden />
        {hasUnread && (
          <span
            data-unread-marker
            aria-hidden
            className="absolute right-0.5 top-0.5 size-2 rounded-pill bg-badge ring-2 ring-chrome"
          />
        )}
      </span>
      <span className="text-caption font-bold">Início</span>
    </Link>
  );
}
