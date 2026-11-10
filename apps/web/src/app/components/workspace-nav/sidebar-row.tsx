"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChannelIcon } from "@/app/components/conversation/channel-icon";
import { Avatar } from "@/app/components/ui/avatar";
import type { Conversation } from "@/app/services/chat-api";
import { cn } from "@/app/utils/cn";
import { isSelfConversation } from "@/app/utils/conversation-title";

type SidebarRowProps = {
  href: string;
  conversation: Pick<Conversation, "kind" | "name" | "counterpart">;
  // A Pessoa da Sessão: a Conversa direta consigo mesma leva "você" ao lado do nome.
  selfId: string;
};

// Linha de Conversa da barra lateral (SidebarRow): h-7, ou 44 px abaixo de md, raio item. A da Conversa aberta fica
// ativa, com o fundo de seleção e aria-current. Na Conversa direta, o avatar e o nome da outra
// Pessoa no lugar do ícone e do nome do Canal (spec da F05, "Lista de Conversas e barra lateral").
export function SidebarRow({ href, conversation, selfId }: SidebarRowProps) {
  const { kind, name, counterpart } = conversation;
  const isActive = usePathname() === href;
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
        )}
      >
        {kind === "direct" && counterpart ? (
          <>
            <Avatar initials={counterpart.initials} seed={counterpart.id} size="xs" />
            <span className="truncate">{counterpart.name}</span>
            {isSelfConversation(conversation, selfId) && <span className="shrink-0 opacity-70">você</span>}
          </>
        ) : (
          <>
            <ChannelIcon kind={kind} size={16} className="shrink-0" />
            <span className="truncate">{name}</span>
          </>
        )}
      </Link>
    </li>
  );
}
