"use client";

import { Avatar } from "@/app/components/ui/avatar";
import type { PersonEntry } from "@/app/services/chat-api";
import { cn } from "@/app/utils/cn";

type MentionPickerProps = {
  id: string;
  people: PersonEntry[];
  activeIndex: number;
  optionId: (index: number) => string;
  pick: (person: PersonEntry) => void;
};

// A lista de menções (MentionOption em lista; spec da F06, "Lista de menções"), acima da caixa de
// texto: avatar, nome e "@usuário · cargo". O clique escolhe sem tirar o foco da caixa.
export function MentionPicker({ id, people, activeIndex, optionId, pick }: MentionPickerProps) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Pessoas para mencionar"
      className="absolute bottom-full left-0 right-0 z-20 mb-2 flex max-h-72 flex-col overflow-y-auto rounded-card bg-surface-raised py-2 shadow-2"
    >
      {people.map((person, index) => (
        <li
          key={person.id}
          id={optionId(index)}
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => {
            event.preventDefault();
            pick(person);
          }}
          className={cn(
            "flex min-h-9 cursor-pointer items-center gap-2 px-4 text-body text-fg",
            index === activeIndex && "bg-sidebar-active text-sidebar-on-active",
          )}
        >
          <Avatar initials={person.initials} seed={person.id} size="xs" />
          <span className="font-bold">{person.name}</span>
          <span
            className={cn(
              "truncate text-small",
              index === activeIndex ? "text-sidebar-on-active" : "text-fg-muted",
            )}
          >
            @{person.username}
            {person.title ? ` · ${person.title}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
