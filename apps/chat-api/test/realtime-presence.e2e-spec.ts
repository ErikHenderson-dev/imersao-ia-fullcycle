import { INestApplication } from '@nestjs/common';
import type { PresenceChangedEvent } from 'chat-events';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import {
  listenTestApp,
  realtimeRoutes,
  settle,
  TestSocket,
  waitForCount,
} from './support/realtime-routes';

// A carência reduzida para os testes (support/test-env.ts).
const GRACE_MS = Number(process.env.PRESENCE_GRACE_MS);

describe('Presença em tempo real', () => {
  let app: INestApplication;
  let url: string;
  const sockets: TestSocket[] = [];

  beforeAll(async () => {
    ({ app, url } = await listenTestApp());
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  async function connected(token: string) {
    const socket = await realtimeRoutes.connected(url, { token });
    sockets.push(socket);
    return socket;
  }

  // A sala `workspace` leva os eventos de todos os testes: cada um junta só os da própria Pessoa.
  function changesOf(socket: TestSocket, personId: string) {
    const received: PresenceChangedEvent[] = [];
    socket.on('presence.changed', (event) => {
      if (event.person_id === personId) received.push(event);
    });
    return received;
  }

  function snapshot(cookie: string) {
    return request(app.getHttpServer() as App)
      .get('/v1/people/presence')
      .set('Cookie', cookie);
  }

  it('a primeira aba deixa a Pessoa disponível para os outros, e a segunda não publica', async () => {
    const ana = await authRoutes.loggedIn(app);
    const bruno = await authRoutes.loggedIn(app);
    const watcher = await connected(bruno.token);
    const changes = changesOf(watcher, ana.person.id);

    await connected(ana.token);
    await connected(ana.token);

    await waitForCount(changes, 1);
    await settle();
    expect(changes).toEqual([
      { person_id: ana.person.id, presence: 'available' },
    ]);
    const response = await snapshot(bruno.cookie);
    const body = response.body as {
      people: { id: string; presence: string }[];
    };
    expect(body.people.find((person) => person.id === ana.person.id)).toEqual({
      id: ana.person.id,
      presence: 'available',
      status: null,
    });
  });

  it('fechar a última aba deixa ausente depois da carência', async () => {
    const ana = await authRoutes.loggedIn(app);
    const bruno = await authRoutes.loggedIn(app);
    const watcher = await connected(bruno.token);
    const changes = changesOf(watcher, ana.person.id);
    const tab = await connected(ana.token);
    await waitForCount(changes, 1);

    tab.disconnect();

    await settle(GRACE_MS / 2);
    expect(changes).toHaveLength(1);
    await waitForCount(changes, 2);
    expect(changes[1]).toEqual({ person_id: ana.person.id, presence: 'away' });
  });

  it('definir como ausente com a Pessoa conectada publica, e a mesma escolha de novo não', async () => {
    const ana = await authRoutes.loggedIn(app);
    const bruno = await authRoutes.loggedIn(app);
    const watcher = await connected(bruno.token);
    const changes = changesOf(watcher, ana.person.id);
    await connected(ana.token);
    await waitForCount(changes, 1);
    const choose = () =>
      request(app.getHttpServer() as App)
        .put('/v1/people/me/presence')
        .set('Cookie', ana.cookie)
        .send({ presence_choice: 'away' })
        .expect(204);

    await choose();
    await choose();

    await waitForCount(changes, 2);
    await settle();
    expect(changes).toEqual([
      { person_id: ana.person.id, presence: 'available' },
      { person_id: ana.person.id, presence: 'away' },
    ]);
  });
});
