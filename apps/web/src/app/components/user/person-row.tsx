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
  const detail = [`@${person.username}`, person.title].filter(Boolean).join(" · ");
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
