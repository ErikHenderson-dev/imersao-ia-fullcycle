import { initials } from "./initials";

// O que a camada guarda de cada Pessoa (spec da F09, "Cliente", "Camada de Pessoas"): o nome atual,
// as iniciais dele e, quando um evento os trouxe, o @usuário e o cargo.
export type KnownPerson = {
  id: string;
  name: string;
  initials: string;
  username?: string;
  title?: string | null;
};

// O que um evento ou o Perfil salvo trazem; sem `title`, o cargo continua o que era.
export type PersonChange = { id: string; name: string; username?: string; title?: string | null };

export type PeopleStore = {
  get: (personId: string) => KnownPerson | undefined;
  // Grava o que mudou na Pessoa; devolve se algo mudou.
  apply: (change: PersonChange) => boolean;
  // Esquece todas as Pessoas, menos `keepId`: os payloads lidos de novo voltam a valer.
  forgetAllBut: (keepId: string) => void;
  // Cresce a cada mudança: quem lê várias Pessoas de uma vez assina por ela.
  version: () => number;
  subscribe: (listener: () => void) => () => void;
};

// Um mapa de id para Pessoa, lido por useSyncExternalStore: cada entrada só troca de objeto quando
// o nome muda, e só os componentes dela renderizam de novo.
export function createPeopleStore(seed: PersonChange[] = []): PeopleStore {
  const entries = new Map<string, KnownPerson>();
  const listeners = new Set<() => void>();
  let currentVersion = 0;

  function put(change: PersonChange): boolean {
    const current = entries.get(change.id);
    const next: KnownPerson = {
      ...current,
      ...change,
      initials: current?.name === change.name ? current.initials : initials(change.name),
    };
    if (
      current &&
      current.name === next.name &&
      current.username === next.username &&
      current.title === next.title
    ) {
      return false;
    }
    entries.set(change.id, next);
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
