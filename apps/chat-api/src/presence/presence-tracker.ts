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
  // A escolha gravada mais nova de cada Pessoa que a trocou, com a hora da gravação: vale também
  // para quem não está conectado, e uma aba que conecta usa ela em vez da lida no handshake.
  private readonly savedChoices = new Map<
    string,
    { choice: PresenceChoice; at: number }
  >();
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

  // Uma aba conectou. A escolha lida no handshake só vale para quem não estava sendo seguido e não
  // gravou outra depois: a escolha gravada pela rota enquanto o handshake corria é mais nova.
  connected(personId: string, handshakeChoice: PresenceChoice): void {
    this.track(personId, () => {
      const entry = this.tracked.get(personId);
      if (!entry) {
        const choice =
          this.savedChoices.get(personId)?.choice ?? handshakeChoice;
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

  // A Pessoa gravou uma escolha em `savedAt`. Uma gravação mais velha que a última conhecida, cuja
  // continuação chegou depois, não muda nada. A Presença só muda para quem está sendo seguido.
  choiceChanged(
    personId: string,
    choice: PresenceChoice,
    savedAt: number,
  ): void {
    const saved = this.savedChoices.get(personId);
    if (saved && saved.at > savedAt) return;
    this.savedChoices.set(personId, { choice, at: savedAt });
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
