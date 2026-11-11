"use client";

import { AgentAvatar } from "@/app/components/agent/agent-avatar";
import { Avatar } from "@/app/components/ui/avatar";
import type { MentionOption } from "@/app/hooks/use-mention-picker";
import { cn } from "@/app/utils/cn";

type MentionPickerProps = {
  id: string;
  options: MentionOption[];
  activeIndex: number;
  optionId: (index: number) => string;
  pick: (option: MentionOption) => void;
};

// A lista de menções (MentionOption em lista; spec da F06, "Lista de menções"), acima da caixa de
// texto: avatar, nome e "@usuário · cargo"; os Agentes conectados vêm depois dos Membros, com o
// AgentAvatar e "@usuário · Agente" (spec da F10). O clique escolhe sem tirar o foco da caixa.
export function MentionPicker({ id, options, activeIndex, optionId, pick }: MentionPickerProps) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Pessoas para mencionar"
      className="absolute bottom-full left-0 right-0 z-20 mb-2 flex max-h-72 flex-col overflow-y-auto rounded-card bg-surface-raised py-2 shadow-2"
    >
      {options.map((option, index) => {
        const isActive = index === activeIndex;
        const name = option.kind === "person" ? option.person.name : option.agent.name;
        const detail =
          option.kind === "person"
            ? `@${option.person.username}${option.person.title ? ` · ${option.person.title}` : ""}`
            : `@${option.agent.username} · Agente`;
        return (
          <li
            key={option.kind === "person" ? option.person.id : `agent-${option.agent.slug}`}
            id={optionId(index)}
            role="option"
            aria-selected={isActive}
            onMouseDown={(event) => {
              event.preventDefault();
              pick(option);
            }}
            className={cn(
              "flex min-h-9 cursor-pointer items-center gap-2 px-4 text-body text-fg",
              isActive && "bg-sidebar-active text-sidebar-on-active",
            )}
          >
            {option.kind === "person" ? (
              <Avatar initials={option.person.initials} seed={option.person.id} size="xs" />
            ) : (
              <AgentAvatar size="xs" />
            )}
            <span className="font-bold">{name}</span>
            <span
              className={cn("truncate text-small", isActive ? "text-sidebar-on-active" : "text-fg-muted")}
            >
              {detail}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
