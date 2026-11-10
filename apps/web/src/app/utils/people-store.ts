import type { Presence, StatusPayload } from "chat-events";
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
  // Marca o começo de uma leitura do retrato: o que mudar depois dela vale mais que ele.
  snapshotMark: () => number;
  // A Presença de uma Pessoa, ou indefinida antes do primeiro retrato.
  getPresence: (personId: string) => Presence | undefined;
  // A Presença que mudou (`presence.changed`, ou a própria escolha); devolve se mudou.
  applyPresence: (personId: string, presence: Presence) => boolean;
  // O retrato de quem está disponível ou tem Status (spec da F09, "Camada de Pessoas"), lido desde
  // `mark`: quem não está nele fica ausente e sem Status, menos quem mudou depois da marca.
  applySnapshot: (
    people: { id: string; presence?: Presence; status: StatusPayload | null }[],
    mark: number,
  ) => void;
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
  // Quando o Status de cada Pessoa mudou por último, na contagem de `statusClock`.
  const statusChangedAt = new Map<string, number>();
  let statusClock = 0;
  let presences = new Map<string, Presence>();
  const presenceChangedAt = new Map<string, number>();

  function readPresence(personId: string): Presence | undefined {
    return presences.get(personId) ?? (hasSnapshot ? "away" : undefined);
  }

  function readStatus(personId: string): StatusPayload | null | undefined {
    if (statuses.has(personId)) return statuses.get(personId);
    return hasSnapshot ? null : undefined;
  }

  function sameStatus(a: StatusPayload | null | undefined, b: StatusPayload | null | undefined) {
    return a === b || (!!a && !!b && a.emoji === b.emoji && a.text === b.text);
  }

  function putStatus(personId: string, status: StatusPayload | null): boolean {
    if (sameStatus(readStatus(personId), status)) return false;
    statuses.set(personId, status);
    statusClock += 1;
    statusChangedAt.set(personId, statusClock);
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
    getStatus: readStatus,
    getPresence: readPresence,
    applyPresence(personId, presence) {
      if (readPresence(personId) === presence) return false;
      presences.set(personId, presence);
      statusClock += 1;
      presenceChangedAt.set(personId, statusClock);
      notify();
      return true;
    },
    snapshotMark: () => statusClock,
    applySnapshot(people, mark) {
      const next = new Map<string, StatusPayload | null>();
      for (const person of people) {
        const current = statuses.get(person.id);
        // O mesmo Status guarda o objeto de antes: quem o mostra não renderiza de novo.
        next.set(person.id, sameStatus(current, person.status) ? (current ?? null) : person.status);
      }
      // O que mudou depois de a leitura começar é mais novo que o retrato.
      for (const [personId, changedAt] of statusChangedAt) {
        if (changedAt > mark) next.set(personId, statuses.get(personId) ?? null);
      }
      const nextPresences = new Map<string, Presence>();
      for (const person of people) {
        if (person.presence) nextPresences.set(person.id, person.presence);
      }
      for (const [personId, changedAt] of presenceChangedAt) {
        const current = presences.get(personId);
        if (changedAt > mark && current) nextPresences.set(personId, current);
      }
      const presenceChanged =
        nextPresences.size !== presences.size ||
        [...nextPresences].some(([personId, value]) => presences.get(personId) !== value);
      presences = nextPresences;
      const changed =
        presenceChanged ||
        !hasSnapshot ||
        [...new Set([...statuses.keys(), ...next.keys()])].some(
          (personId) => !sameStatus(statuses.get(personId) ?? null, next.get(personId) ?? null),
        );
      statuses = next;
      hasSnapshot = true;
      if (changed) notify();
    },
    version: () => currentVersion,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
