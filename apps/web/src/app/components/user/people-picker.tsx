"use client";

import { Check, Search } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/app/components/ui/input";
import type { PersonEntry } from "@/app/services/chat-api";
import { cn } from "@/app/utils/cn";
import { PersonRow } from "./person-row";

type PeoplePickerProps = {
  query: string;
  onQueryChange: (query: string) => void;
  // As Pessoas da busca, ou null enquanto a primeira não respondeu.
  people: readonly PersonEntry[] | null;
  onPick: (person: PersonEntry) => void;
  // A Pessoa da Sessão, com "(você)" ao lado.
  selfId?: string;
  // As escolhidas, marcadas (o passo "Adicionar pessoas" escolhe várias).
  selectedIds?: ReadonlySet<string>;
  disabled?: boolean;
  // O que aparece no lugar da lista: o carregamento, a falha ou "Ninguém encontrado".
  emptyState?: React.ReactNode;
};

// A busca de Pessoas do "Nova conversa" e do "Adicionar pessoas" (spec da F05, "Busca de
// Pessoas"): um combobox, com o foco no campo; as setas mudam a Pessoa destacada, por
// aria-activedescendant, e Enter a escolhe, como o clique.
export function PeoplePicker({
  query,
  onQueryChange,
  people,
  onPick,
  selfId,
  selectedIds,
  disabled = false,
  emptyState,
}: PeoplePickerProps) {
  const inputId = useId();
  const listId = useId();
  const [active, setActive] = useState(0);
  const options = people ?? [];
  // A destacada volta para a primeira quando a lista muda de tamanho.
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0));
  const optionId = (index: number) => `${listId}-${index}`;

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!disabled) onPick(options[activeIndex]);
    }
  }

  return (
    <>
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Buscar pessoas
        </label>
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
        />
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options.length > 0 ? optionId(activeIndex) : undefined}
          value={query}
          placeholder="Buscar por nome ou @usuário"
          autoComplete="off"
          readOnly={disabled}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="pl-9"
        />
      </div>
      <div aria-live="polite" className="flex max-h-72 flex-col overflow-y-auto">
        {options.length === 0 && emptyState}
        <ul
          id={listId}
          role="listbox"
          aria-label="Pessoas"
          aria-multiselectable={selectedIds ? true : undefined}
          className={cn("flex flex-col", disabled && "opacity-50")}
        >
          {options.map((person, index) => {
            const isSelected = selectedIds?.has(person.id) ?? false;
            return (
              <li
                key={person.id}
                id={optionId(index)}
                role="option"
                aria-selected={selectedIds ? isSelected : index === activeIndex}
                aria-disabled={disabled || undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setActive(index);
                  if (!disabled) onPick(person);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-item p-2",
                  index === activeIndex ? "bg-surface-subtle" : "hover:bg-surface-subtle",
                )}
              >
                <PersonRow person={person} isSelf={person.id === selfId} />
                {isSelected && <Check size={18} aria-hidden className="shrink-0 text-primary" />}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
