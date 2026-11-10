import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Presence } from 'chat-events';
import type { Env } from '../config/env.schema';

export type PresenceChoice = 'available' | 'away';

// A Presença das Pessoas, em memória (spec da F09, "Presença"; LLD, "Estados e regras", "Presença"):
// conta os sockets de cada Pessoa e espera a `carência da presença` antes de dar como desconectada
// quem perdeu o último. Vale para uma instância da API (HLD, seção 6.2).
@Injectable()
export class PresenceTracker implements OnModuleDestroy {
  private readonly sockets = new Map<string, number>();
  private readonly graceTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  // A escolha de quem está conectado ou na carência.
  private readonly choices = new Map<string, PresenceChoice>();
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

  presenceOf(personId: string): Presence {
    const isConnected =
      (this.sockets.get(personId) ?? 0) > 0 || this.graceTimers.has(personId);
    return isConnected && this.choices.get(personId) === 'available'
      ? 'available'
      : 'away';
  }

  // Quem está disponível agora, para o retrato.
  availableIds(): string[] {
    return [...this.choices.keys()].filter(
      (personId) => this.presenceOf(personId) === 'available',
    );
  }

  connected(personId: string, choice: PresenceChoice): void {
    this.track(personId, () => {
      const timer = this.graceTimers.get(personId);
      if (timer) {
        clearTimeout(timer);
        this.graceTimers.delete(personId);
      }
      this.sockets.set(personId, (this.sockets.get(personId) ?? 0) + 1);
      this.choices.set(personId, choice);
    });
  }

  disconnected(personId: string): void {
    const remaining = (this.sockets.get(personId) ?? 0) - 1;
    if (remaining > 0) {
      this.sockets.set(personId, remaining);
      return;
    }
    this.sockets.delete(personId);
    // A carência: uma queda curta, ou trocar de página, não muda o que os outros veem.
    const timer = setTimeout(() => {
      this.track(personId, () => {
        this.graceTimers.delete(personId);
        this.choices.delete(personId);
      });
    }, this.graceMs);
    timer.unref?.();
    this.graceTimers.set(personId, timer);
  }

  // A Pessoa trocou a escolha: muda a Presença só de quem está conectado.
  choiceChanged(personId: string, choice: PresenceChoice): void {
    if (!this.choices.has(personId)) return;
    this.track(personId, () => this.choices.set(personId, choice));
  }

  onModuleDestroy(): void {
    this.graceTimers.forEach((timer) => clearTimeout(timer));
    this.graceTimers.clear();
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
