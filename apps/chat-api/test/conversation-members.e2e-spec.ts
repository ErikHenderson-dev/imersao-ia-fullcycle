import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type MembersBody = { members: { id: string; name: string }[] };

describe('Membros de uma Conversa', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  const members = (cookie: string, conversationId: string) =>
    request(server)
      .get(`/v1/conversations/${conversationId}/members`)
      .set('Cookie', cookie);

  it('devolve os Membros em ordem alfabética', async () => {
    const owner = await authRoutes.loggedIn(app, { name: 'Zélia Souza' });
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      owner.cookie,
    );
    const ana = await authRoutes.createPerson(app, { name: 'Ábaco Lima' });
    const bruno = await authRoutes.createPerson(app, { name: 'abelha Costa' });
    await conversationRoutes
      .addMembers(app, owner.cookie, channelId, [
        ana.person.id,
        bruno.person.id,
      ])
      .expect(200);

    const response = await members(owner.cookie, channelId);

    expect(response.status).toBe(200);
    expect((response.body as MembersBody).members).toEqual([
      {
        id: ana.person.id,
        name: 'Ábaco Lima',
        username: ana.person.username,
        title: null,
        status: null,
      },
      {
        id: bruno.person.id,
        name: 'abelha Costa',
        username: bruno.person.username,
        title: null,
        status: null,
      },
      {
        id: owner.person.id,
        name: 'Zélia Souza',
        username: owner.person.username,
        title: null,
        status: null,
      },
    ]);
  });

  it('responde 404 para quem não é Membro', async () => {
    const owner = await authRoutes.loggedIn(app);
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      owner.cookie,
    );
    const other = await authRoutes.loggedIn(app);

    const response = await members(other.cookie, channelId);

    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe(
      'conversation_not_found',
    );
  });

  it('responde 401 sem Sessão', async () => {
    const response = await request(server).get(
      `/v1/conversations/${randomUUID()}/members`,
    );

    expect(response.status).toBe(401);
  });
});
