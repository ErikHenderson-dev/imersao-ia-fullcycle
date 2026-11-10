"use client";

import { useKnownPerson } from "@/app/components/people/people-provider";
import { PersonAvatar, PersonName } from "@/app/components/people/person-display";
import type { PersonEntry } from "@/app/services/chat-api";

type PersonRowProps = {
  person: PersonEntry;
  // "(você)" ao lado do nome.
  isSelf?: boolean;
};

// PersonRow (Figma, Features e widgets): a linha de Pessoa em "Nova conversa", "Adicionar
// pessoas" e "Membros", com o avatar de 36 px, o nome em body/bold e, embaixo, "@usuário · cargo"
// (spec da F05, "Busca de Pessoas").
export function PersonRow({ person, isSelf }: PersonRowProps) {
  // O cargo atual, quando um person.updated o trouxe (spec da F09, "Camada de Pessoas").
  const known = useKnownPerson(person.id);
  const title = known?.title !== undefined ? known.title : person.title;
  const detail = [`@${person.username}`, title].filter(Boolean).join(" · ");
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <PersonAvatar person={person} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-bold text-fg">
          <PersonName id={person.id} name={person.name} />
          {isSelf && <span className="font-normal text-fg-muted"> (você)</span>}
        </span>
        <span className="truncate text-small text-fg-muted">{detail}</span>
      </span>
    </span>
  );
}
