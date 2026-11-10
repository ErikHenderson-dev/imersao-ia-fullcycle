import { initials } from "./initials";

// O que a camada guarda de cada Pessoa (spec da F09, "Cliente", "Camada de Pessoas"): o nome atual
// e as iniciais dele.
export type KnownPerson = { id: string; name: string; initials: string };

export type PeopleStore = {
  get: (personId: string) => KnownPerson | undefined;
  // Grava o nome da Pessoa; devolve se algo mudou.
  apply: (change: { id: string; name: string }) => boolean;
  // Esquece todas as Pessoas, menos `keepId`: os payloads lidos de novo voltam a valer.
  forgetAllBut: (keepId: string) => void;
  // Cresce a cada mudança: quem lê várias Pessoas de uma vez assina por ela.
  version: () => number;
  subscribe: (listener: () => void) => () => void;
};

// Um mapa de id para Pessoa, lido por useSyncExternalStore: cada entrada só troca de objeto quando
// o nome muda, e só os componentes dela renderizam de novo.
export function createPeopleStore(seed: { id: string; name: string }[] = []): PeopleStore {
  const entries = new Map<string, KnownPerson>();
  const listeners = new Set<() => void>();
  let currentVersion = 0;

  function put(change: { id: string; name: string }): boolean {
    if (entries.get(change.id)?.name === change.name) return false;
    entries.set(change.id, { id: change.id, name: change.name, initials: initials(change.name) });
    return true;
  }

  function notify() {
    currentVersion += 1;
    listeners.forEach((listener) => listener());
  }

  seed.forEach(put);
  return {
    get: (personId) => entries.get(personId),
    apply(change) {
      const changed = put(change);
      if (changed) notify();
      return changed;
    },
    forgetAllBut(keepId) {
      const kept = entries.get(keepId);
      if (entries.size === (kept ? 1 : 0)) return;
      entries.clear();
      if (kept) entries.set(keepId, kept);
      notify();
    },
    version: () => currentVersion,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
