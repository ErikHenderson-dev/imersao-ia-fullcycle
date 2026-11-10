import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Presence } from 'chat-events';
import type { Env } from '../config/env.schema';

// A escolha de presença tem os mesmos valores da Presença calculada.
export type PresenceChoice = Presence;

// O que o rastreador sabe de cada Pessoa conectada ou na carência.
interface Tracked {
  sockets: number;
  choice: PresenceChoice;
  graceTimer?: ReturnType<typeof setTimeout>;
}

// A Presença das Pessoas, em memória (spec da F09, "Presença"; LLD, "Estados e regras", "Presença"):
// conta os sockets de cada Pessoa e espera a `carência da presença` antes de dar como desconectada
// quem perdeu o último. Vale para uma instância da API (HLD, seção 6.2).
@Injectable()
export class PresenceTracker implements OnModuleDestroy {
  private readonly tracked = new Map<string, Tracked>();
  private readonly listeners = new Set<
    (personId: string, presence: Presence) => void
  >();
  private readonly graceMs: number;

  constructor(config: ConfigService<Env, true>) {
    this.graceMs = config.get('PRESENCE_GRACE_MS', { infer: true });
  }

  // Avisa cada mudança da Presença calculada.
  onChange(
    listener: (personId: string, presence: Presence) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Disponível só conectada (ou na carência) e com a escolha `available`.
  presenceOf(personId: string): Presence {
    return this.tracked.get(personId)?.choice === 'available'
      ? 'available'
      : 'away';
  }

  // Quem está disponível agora, para o retrato.
  availableIds(): string[] {
    return [...this.tracked]
      .filter(([, entry]) => entry.choice === 'available')
      .map(([personId]) => personId);
  }

  // Uma aba conectou. A escolha lida no handshake só vale para quem não estava sendo seguido: a de
  // quem já está conectado é a mais nova, trocada pela rota enquanto o handshake corria.
  connected(personId: string, choice: PresenceChoice): void {
    this.track(personId, () => {
      const entry = this.tracked.get(personId);
      if (!entry) {
        this.tracked.set(personId, { sockets: 1, choice });
        return;
      }
      clearTimeout(entry.graceTimer);
      entry.graceTimer = undefined;
      entry.sockets += 1;
    });
  }

  disconnected(personId: string): void {
    const entry = this.tracked.get(personId);
    if (!entry || entry.sockets === 0) return;
    entry.sockets -= 1;
    if (entry.sockets > 0) return;
    // A carência: uma queda curta, ou trocar de página, não muda o que os outros veem.
    clearTimeout(entry.graceTimer);
    entry.graceTimer = setTimeout(() => {
      this.track(personId, () => this.tracked.delete(personId));
    }, this.graceMs);
    entry.graceTimer.unref?.();
  }

  // A Pessoa trocou a escolha: muda a Presença só de quem está sendo seguido.
  choiceChanged(personId: string, choice: PresenceChoice): void {
    const entry = this.tracked.get(personId);
    if (!entry) return;
    this.track(personId, () => {
      entry.choice = choice;
    });
  }

  onModuleDestroy(): void {
    this.tracked.forEach((entry) => clearTimeout(entry.graceTimer));
    this.tracked.clear();
  }

  private track(personId: string, change: () => void): void {
    const before = this.presenceOf(personId);
    change();
    const after = this.presenceOf(personId);
    if (before !== after) {
      this.listeners.forEach((listener) => listener(personId, after));
    }
  }
}

// As Pessoas de uma lista com a Presença de cada uma (spec da F09, "Rotas").
export function withPresence<T extends { id: string }>(
  tracker: PresenceTracker,
  people: T[],
): (T & { presence: Presence })[] {
  return people.map((person) => ({
    ...person,
    presence: tracker.presenceOf(person.id),
  }));
}
