import { initials } from "./initials";

// O que a camada guarda de cada Pessoa (spec da F09, "Cliente", "Camada de Pessoas").
export type PersonEntry = {
  id: string;
  name: string;
  initials: string;
  username: string;
  title: string | null;
};

// O que um evento ou o Perfil salvo trazem; as iniciais saem do nome.
export type PersonChange = Omit<PersonEntry, "initials">;

export type PeopleStore = {
  get: (personId: string) => PersonEntry | undefined;
  apply: (change: PersonChange) => void;
  subscribe: (listener: () => void) => () => void;
};

// Um mapa de id para Pessoa, lido por useSyncExternalStore: cada entrada só troca de objeto quando
// a Pessoa muda, e só os componentes dela renderizam de novo.
export function createPeopleStore(seed: PersonChange[] = []): PeopleStore {
  const entries = new Map<string, PersonEntry>();
  const listeners = new Set<() => void>();

  function put(change: PersonChange): boolean {
    const current = entries.get(change.id);
    if (
      current &&
      current.name === change.name &&
      current.username === change.username &&
      current.title === change.title
    ) {
      return false;
    }
    entries.set(change.id, { ...change, initials: initials(change.name) });
    return true;
  }

  seed.forEach(put);
  return {
    get: (personId) => entries.get(personId),
    apply(change) {
      if (put(change)) listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// O nome e as iniciais a mostrar: os da camada, quando ela conhece a Pessoa, ou os do payload.
export function displayedPerson<T extends { name: string; initials: string }>(
  entry: PersonEntry | undefined,
  fallback: T,
): T {
  return entry ? { ...fallback, name: entry.name, initials: entry.initials } : fallback;
}
