import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PeopleService } from '../src/people/people.service';
import { authRoutes } from './support/auth-routes';
import {
  collectEvents,
  listenTestApp,
  realtimeRoutes,
  settle,
  TestSocket,
  waitForCount,
} from './support/realtime-routes';

describe('Mudança de Agentes em tempo real', () => {
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

  async function admin() {
    const logged = await authRoutes.loggedIn(app);
    await app.get(PeopleService).setAdmin(logged.person.id, true);
    return logged;
  }

  function announce(cookie: string) {
    return request(app.getHttpServer() as App)
      .post('/v1/agents/changed')
      .set('Cookie', cookie)
      .expect(204);
  }

  it('entrega agents.changed, sem carga, a todas as abas, inclusive às de quem pediu', async () => {
    const announcer = await admin();
    const other = await authRoutes.loggedIn(app);
    const tabs = [
      await connected(announcer.token),
      await connected(other.token),
      await connected(other.token),
    ];
    const received = tabs.map((tab) => collectEvents(tab, 'agents.changed'));

    await announce(announcer.cookie);

    for (const events of received) await waitForCount(events, 1);
    expect(received.map((events) => events[0])).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('não volta na reconexão com cursor', async () => {
    const announcer = await admin();
    const reader = await authRoutes.loggedIn(app);
    const first = await connected(reader.token);
    const syncs = collectEvents(first, 'sync');
    await waitForCount(syncs, 1);
    first.disconnect();
    await announce(announcer.cookie);
    const socket = realtimeRoutes.socket(url, {
      token: reader.token,
      cursor: syncs[0].cursor ?? undefined,
    });
    sockets.push(socket);
    const changes = collectEvents(socket, 'agents.changed');
    const replaySync = collectEvents(socket, 'sync');

    socket.connect();

    await waitForCount(replaySync, 1);
    await settle();
    expect(changes).toEqual([]);
  });
});
