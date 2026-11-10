"use client";

import type { Presence } from "chat-events";
import { Avatar } from "@/app/components/ui/avatar";
import { PresenceDot, type PresenceBackdrop } from "@/app/components/ui/presence-dot";
import { useKnownPerson, useKnownPresence } from "./people-provider";

// O nome de uma Pessoa, o da camada de Pessoas quando ela o conhece (spec da F09, "Cliente",
// "Componentes de Pessoa").
export function PersonName({ id, name }: { id: string; name: string }) {
  return useKnownPerson(id)?.name ?? name;
}

type PersonAvatarProps = Omit<React.ComponentProps<typeof Avatar>, "initials" | "seed"> & {
  person: { id: string; initials: string; presence?: Presence };
  // Com ele, a bolinha de Presença no canto, recortando o fundo do lugar (UserAvatar).
  presenceBackdrop?: PresenceBackdrop;
};

// O avatar de uma Pessoa, com as iniciais do nome atual e, quando pedida, a Presença.
export function PersonAvatar({ person, presenceBackdrop, ...props }: PersonAvatarProps) {
  const initials = useKnownPerson(person.id)?.initials ?? person.initials;
  const avatar = <Avatar initials={initials} seed={person.id} {...props} />;
  if (!presenceBackdrop) return avatar;
  return (
    <span className="relative inline-flex shrink-0">
      {avatar}
      <PersonPresenceDot
        personId={person.id}
        presence={person.presence}
        backdrop={presenceBackdrop}
        decorative
        className="absolute -right-0.5 -bottom-0.5"
      />
    </span>
  );
}

// A bolinha de Presença de uma Pessoa, pela camada de Pessoas; antes do primeiro retrato, a do
// payload, ou nada.
export function PersonPresenceDot({
  personId,
  presence: fromPayload,
  ...props
}: {
  personId: string;
  presence?: Presence;
} & Omit<React.ComponentProps<typeof PresenceDot>, "presence">) {
  const presence = useKnownPresence(personId, fromPayload);
  return presence ? <PresenceDot presence={presence} {...props} /> : null;
}
