"use client";

import { Avatar } from "@/app/components/ui/avatar";
import { useKnownPerson } from "./people-provider";

// O nome de uma Pessoa, o da camada de Pessoas quando ela o conhece (spec da F09, "Cliente",
// "Componentes de Pessoa").
export function PersonName({ id, name }: { id: string; name: string }) {
  return useKnownPerson(id)?.name ?? name;
}

type PersonAvatarProps = Omit<React.ComponentProps<typeof Avatar>, "initials" | "seed"> & {
  person: { id: string; initials: string };
};

// O avatar de uma Pessoa, com as iniciais do nome atual.
export function PersonAvatar({ person, ...props }: PersonAvatarProps) {
  const initials = useKnownPerson(person.id)?.initials ?? person.initials;
  return <Avatar initials={initials} seed={person.id} {...props} />;
}
