import { Avatar } from "@/app/components/ui/avatar";
import type { PersonEntry, PersonSummary } from "@/app/services/chat-api";

type PersonRowProps = {
  person: PersonSummary | PersonEntry;
  // "(você)" ao lado do nome.
  isSelf?: boolean;
};

// PersonRow (Figma, Features e widgets): a linha de Pessoa em "Nova conversa", "Adicionar
// pessoas" e "Membros", com o avatar de 36 px, o nome em body/bold e, embaixo, "@usuário · cargo"
// (spec da F05, "Busca de Pessoas").
export function PersonRow({ person, isSelf }: PersonRowProps) {
  const detail =
    "username" in person
      ? [`@${person.username}`, person.title].filter(Boolean).join(" · ")
      : null;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar initials={person.initials} seed={person.id} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-bold text-fg">
          {person.name}
          {isSelf && <span className="font-normal text-fg-muted"> (você)</span>}
        </span>
        {detail && <span className="truncate text-small text-fg-muted">{detail}</span>}
      </span>
    </span>
  );
}
