import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { PresenceTracker } from './presence-tracker';

const GRACE_MS = 30_000;

function tracker() {
  const config = { get: () => GRACE_MS } as unknown as ConfigService<Env, true>;
  const presence = new PresenceTracker(config);
  const changes: [string, string][] = [];
  presence.onChange((personId, value) => changes.push([personId, value]));
  return { presence, changes };
}

describe('rastreador de presença', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a primeira conexão deixa disponível quem escolheu disponível', () => {
    const { presence, changes } = tracker();

    presence.connected('ana', 'available');

    expect(presence.presenceOf('ana')).toBe('available');
    expect(changes).toEqual([['ana', 'available']]);
  });

  it('quem escolheu ausente fica ausente mesmo conectado, sem publicar', () => {
    const { presence, changes } = tracker();

    presence.connected('ana', 'away');

    expect(presence.presenceOf('ana')).toBe('away');
    expect(changes).toEqual([]);
  });

  it('a segunda aba e o fechamento de uma de duas não publicam', () => {
    const { presence, changes } = tracker();
    presence.connected('ana', 'available');

    presence.connected('ana', 'available');
    presence.disconnected('ana');
    jest.advanceTimersByTime(GRACE_MS * 2);

    expect(presence.presenceOf('ana')).toBe('available');
    expect(changes).toEqual([['ana', 'available']]);
  });

  it('fechar a última aba só deixa ausente depois da carência', () => {
    const { presence, changes } = tracker();
    presence.connected('ana', 'available');

    presence.disconnected('ana');
    jest.advanceTimersByTime(GRACE_MS - 1);
    const duringGrace = presence.presenceOf('ana');
    jest.advanceTimersByTime(1);

    expect(duringGrace).toBe('available');
    expect(presence.presenceOf('ana')).toBe('away');
    expect(changes).toEqual([
      ['ana', 'available'],
      ['ana', 'away'],
    ]);
  });

  it('reconectar dentro da carência não publica nada', () => {
    const { presence, changes } = tracker();
    presence.connected('ana', 'available');
    presence.disconnected('ana');

    jest.advanceTimersByTime(GRACE_MS / 2);
    presence.connected('ana', 'available');
    jest.advanceTimersByTime(GRACE_MS * 2);

    expect(presence.presenceOf('ana')).toBe('available');
    expect(changes).toEqual([['ana', 'available']]);
  });

  it('trocar a escolha conectada publica, e desconectada não', () => {
    const { presence, changes } = tracker();
    presence.connected('ana', 'available');

    presence.choiceChanged('ana', 'away', 1);
    presence.choiceChanged('bruno', 'away', 1);

    expect(presence.presenceOf('ana')).toBe('away');
    expect(changes).toEqual([
      ['ana', 'available'],
      ['ana', 'away'],
    ]);
  });

  it('lista quem está disponível', () => {
    const { presence } = tracker();
    presence.connected('ana', 'available');
    presence.connected('bruno', 'away');

    expect(presence.availableIds()).toEqual(['ana']);
  });

  it('uma desconexão a mais não encurta a carência', () => {
    const { presence } = tracker();
    presence.connected('ana', 'available');

    presence.disconnected('ana');
    presence.disconnected('ana');
    jest.advanceTimersByTime(GRACE_MS - 1);

    expect(presence.presenceOf('ana')).toBe('available');
  });

  it('uma aba nova não troca a escolha de quem já está conectado', () => {
    const { presence } = tracker();
    presence.connected('ana', 'available');
    presence.choiceChanged('ana', 'away', 1);

    presence.connected('ana', 'available');

    expect(presence.presenceOf('ana')).toBe('away');
  });

  it('a escolha gravada sem aba conectada vale para a aba que conecta com a escolha velha', () => {
    const { presence } = tracker();
    presence.choiceChanged('ana', 'away', 1);

    presence.connected('ana', 'available');

    expect(presence.presenceOf('ana')).toBe('away');
  });

  it('uma gravação mais velha que chega depois não desfaz a mais nova', () => {
    const { presence } = tracker();
    presence.connected('ana', 'available');

    presence.choiceChanged('ana', 'away', 2);
    presence.choiceChanged('ana', 'available', 1);

    expect(presence.presenceOf('ana')).toBe('away');
  });
});
