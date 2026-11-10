"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSWRConfig } from "swr";
import { profileKey } from "@/app/components/profile/profile-panel";
import { useProfilePanelPerson } from "@/app/components/profile/profile-panel-provider";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import { conversationsKey } from "@/app/utils/conversation-list";
import { createPeopleStore, type KnownPerson, type PeopleStore } from "@/app/utils/people-store";

const PeopleContext = createContext<PeopleStore | null>(null);

// A camada de Pessoas das telas logadas (spec da F09, "Cliente", "Camada de Pessoas"): começa pela
// Pessoa da Sessão e acompanha o `person.updated`. Na reconexão, que pode ter perdido eventos, ela
// esquece as outras Pessoas para os payloads lidos de novo valerem, e a lista de Conversas e o
// perfil aberto são lidos de novo; as Mensagens já carregadas guardam o nome que tinham.
export function PeopleProvider({
  sessionPerson,
  children,
}: {
  sessionPerson: { id: string; name: string };
  children: React.ReactNode;
}) {
  const [store] = useState(() => createPeopleStore([sessionPerson]));
  const { subscribe, status } = useRealtime();
  const { mutate } = useSWRConfig();
  const openProfileId = useProfilePanelPerson();
  // Lido nos efeitos sem refazê-los a cada troca de painel.
  const openProfile = useRef(openProfileId);
  useEffect(() => {
    openProfile.current = openProfileId;
  }, [openProfileId]);

  useEffect(
    () =>
      subscribe({
        onPersonUpdated: (change) => {
          // Sem mudança é, quase sempre, a própria aba que salvou e já aplicou o Perfil.
          if (store.apply(change) && change.id === openProfile.current) {
            void mutate(profileKey(change.id));
          }
        },
      }),
    [subscribe, store, mutate],
  );

  // Volta a conectar depois de uma queda: o primeiro "connected" é a conexão que acabou de abrir,
  // com tudo recém-lido.
  const wasDisconnected = useRef(false);
  useEffect(() => {
    if (status === "disconnected") {
      wasDisconnected.current = true;
      return;
    }
    if (status !== "connected" || !wasDisconnected.current) return;
    wasDisconnected.current = false;
    store.forgetAllBut(sessionPerson.id);
    void mutate(conversationsKey(sessionPerson.id));
    if (openProfile.current) void mutate(profileKey(openProfile.current));
  }, [status, store, mutate, sessionPerson.id]);

  return <PeopleContext value={store}>{children}</PeopleContext>;
}

export function usePeopleStore(): PeopleStore {
  const store = useContext(PeopleContext);
  if (!store) throw new Error("usePeopleStore fora do PeopleProvider");
  return store;
}

const noopSubscribe = () => () => {};

// A Pessoa como a camada a conhece, ou nada: quem mostra usa o payload nesse caso. Fora do
// PeopleProvider (telas sem Sessão), sempre nada.
export function useKnownPerson(personId: string | undefined): KnownPerson | undefined {
  const store = useContext(PeopleContext);
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    () => (personId ? store?.get(personId) : undefined),
    () => undefined,
  );
}

// Os nomes atuais de várias Pessoas de uma vez, como as do "digitando".
export function useKnownNames<T extends { id: string; name: string }>(people: readonly T[]): T[] {
  const store = useContext(PeopleContext);
  useSyncExternalStore(store?.subscribe ?? noopSubscribe, () => store?.version() ?? 0, () => 0);
  return people.map((person) => {
    const known = store?.get(person.id);
    return known ? { ...person, name: known.name } : person;
  });
}
