import type { StatusPayload } from "chat-events";
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

// O que um evento ou o Perfil salvo trazem; sem `title`, o cargo continua o que era, e sem `status`,
// o Status.
export type PersonChange = {
  id: string;
  name: string;
  username?: string;
  title?: string | null;
  status?: StatusPayload | null;
};

export type PeopleStore = {
  get: (personId: string) => KnownPerson | undefined;
  // Grava o que mudou na Pessoa; devolve se algo mudou.
  apply: (change: PersonChange) => boolean;
  // Esquece todas as Pessoas, menos `keepId`: os payloads lidos de novo voltam a valer.
  forgetAllBut: (keepId: string) => void;
  // O Status de uma Pessoa: o dela, nulo sem Status, ou indefinido antes do primeiro retrato.
  getStatus: (personId: string) => StatusPayload | null | undefined;
  // O retrato de quem tem Status (spec da F09, "Camada de Pessoas"): quem não está nele fica sem.
  applySnapshot: (people: { id: string; status: StatusPayload | null }[]) => void;
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
  // O Status fica à parte: o retrato traz quem tem Status, sem o nome.
  let statuses = new Map<string, StatusPayload | null>();
  let hasSnapshot = false;

  function sameStatus(a: StatusPayload | null | undefined, b: StatusPayload | null | undefined) {
    return a === b || (!!a && !!b && a.emoji === b.emoji && a.text === b.text);
  }

  function putStatus(personId: string, status: StatusPayload | null): boolean {
    const current = statuses.has(personId) ? statuses.get(personId) : hasSnapshot ? null : undefined;
    if (sameStatus(current, status)) return false;
    statuses.set(personId, status);
    return true;
  }

  function put({ status, ...change }: PersonChange): boolean {
    const statusChanged = status !== undefined && putStatus(change.id, status);
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
      return statusChanged;
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
    getStatus(personId) {
      if (statuses.has(personId)) return statuses.get(personId);
      return hasSnapshot ? null : undefined;
    },
    applySnapshot(people) {
      statuses = new Map(people.map((person) => [person.id, person.status]));
      hasSnapshot = true;
      notify();
    },
    version: () => currentVersion,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
