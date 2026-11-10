"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSWRConfig } from "swr";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import { conversationsKey } from "@/app/utils/conversation-list";
import {
  createPeopleStore,
  displayedPerson,
  type PeopleStore,
  type PersonChange,
} from "@/app/utils/people-store";

const PeopleContext = createContext<PeopleStore | null>(null);

// As chaves do Perfil no SWR (profile-panel.tsx, profileKey): lidas de novo quando a Pessoa muda.
function isProfileKey(key: unknown, personId?: string): boolean {
  if (typeof key !== "string" || !key.startsWith("/api/people/")) return false;
  return personId === undefined || key === `/api/people/${encodeURIComponent(personId)}`;
}

// A camada de Pessoas das telas logadas (spec da F09, "Cliente", "Camada de Pessoas"): começa pela
// Pessoa da Sessão e acompanha o `person.updated`. Na reconexão, a lista de Conversas e o perfil
// aberto são lidos de novo; as Mensagens já carregadas guardam o nome que tinham.
export function PeopleProvider({
  sessionPerson,
  children,
}: {
  sessionPerson: PersonChange;
  children: React.ReactNode;
}) {
  const [store] = useState(() => createPeopleStore([sessionPerson]));
  const { socket, subscribe } = useRealtime();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!socket) return;
    const onPersonUpdated = (change: PersonChange) => {
      store.apply(change);
      void mutate((key) => isProfileKey(key, change.id));
    };
    socket.on("person.updated", onPersonUpdated);
    return () => {
      socket.off("person.updated", onPersonUpdated);
    };
  }, [socket, store, mutate]);

  // O primeiro sync é o da conexão que acabou de abrir, com tudo recém-lido: só os seguintes são
  // reconexões.
  const hasSynced = useRef(false);
  useEffect(
    () =>
      subscribe({
        onSync: () => {
          if (!hasSynced.current) {
            hasSynced.current = true;
            return;
          }
          void mutate(conversationsKey(sessionPerson.id));
          void mutate((key) => isProfileKey(key));
        },
      }),
    [subscribe, mutate, sessionPerson.id],
  );

  return <PeopleContext value={store}>{children}</PeopleContext>;
}

export function usePeopleStore(): PeopleStore {
  const store = useContext(PeopleContext);
  if (!store) throw new Error("usePeopleStore fora do PeopleProvider");
  return store;
}

// O nome e as iniciais de uma Pessoa: os da camada, quando ela a conhece, ou os do payload. Fora do
// PeopleProvider (telas sem Sessão), sempre os do payload.
export function usePerson<T extends { id: string; name: string; initials: string }>(person: T): T {
  const store = useContext(PeopleContext);
  const entry = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    () => store?.get(person.id),
    () => undefined,
  );
  return displayedPerson(entry, person);
}

function noopSubscribe(): () => void {
  return () => {};
}
