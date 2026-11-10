"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChannelIcon } from "@/app/components/conversation/channel-icon";
import { Avatar } from "@/app/components/ui/avatar";
import { CountBadge } from "@/app/components/ui/count-badge";
import type { Conversation } from "@/app/services/chat-api";
import { cn } from "@/app/utils/cn";
import { isSelfConversation } from "@/app/utils/conversation-title";
import { unreadDisplay } from "@/app/utils/unread";

type SidebarRowProps = {
  href: string;
  conversation: Conversation;
  // A Pessoa da Sessão: a Conversa direta consigo mesma leva "você" ao lado do nome.
  selfId: string;
  // A aba está em foco: a Conversa aberta com ela em foco não mostra nada de novo (spec da F07).
  isTabFocused: boolean;
};

// Linha de Conversa da barra lateral (SidebarRow): h-7, ou 44 px abaixo de md, raio item. A da Conversa aberta fica
// ativa, com o fundo de seleção e aria-current. Na Conversa direta, o avatar e o nome da outra
// Pessoa no lugar do ícone e do nome do Canal (spec da F05, "Lista de Conversas e barra lateral").
// Com Não lidas, o nome fica em negrito, com o contador no fim, e um texto só para o leitor de tela
// diz o que há de novo, depois do nome (spec da F07, "Lista de Conversas e barra lateral").
export function SidebarRow({ href, conversation, selfId, isTabFocused }: SidebarRowProps) {
  const { kind, name, counterpart } = conversation;
  const isActive = usePathname() === href;
  const unread = unreadDisplay(conversation, isActive && isTabFocused);
  // Dentro do mesmo span do nome: fora dele, o leitor de tela poria um espaço antes da vírgula.
  const suffix = unread.suffix && <span className="sr-only">{unread.suffix}</span>;
  return (
    <li>
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex h-11 items-center gap-2 rounded-item px-2 text-body md:h-7",
          isActive
            ? "bg-sidebar-active text-sidebar-on-active"
            : "text-sidebar-fg hover:bg-sidebar-hover",
          unread.isUnread && "font-black",
          unread.isUnread && !isActive && "text-sidebar-fg-strong",
        )}
      >
        {kind === "direct" && counterpart ? (
          <>
            <Avatar initials={counterpart.initials} seed={counterpart.id} size="xs" />
            <span className="truncate">
              {counterpart.name}
              {suffix}
            </span>
            {isSelfConversation(conversation, selfId) && <span className="shrink-0 opacity-70">você</span>}
          </>
        ) : (
          <>
            <ChannelIcon kind={kind} size={16} className="shrink-0" />
            <span className="truncate">
              {name}
              {suffix}
            </span>
          </>
        )}
        <CountBadge count={unread.count} className="ml-auto" />
      </Link>
    </li>
  );
}
