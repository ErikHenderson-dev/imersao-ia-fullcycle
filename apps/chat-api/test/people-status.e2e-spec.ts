import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

describe('Status nas leituras de Pessoas', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  const VACATION = { emoji: 'vacation', text: 'De férias até sexta' };

  async function withStatus() {
    const member = await authRoutes.loggedIn(app);
    await request(server)
      .patch('/v1/people/me')
      .set('Cookie', member.cookie)
      .send({ status_emoji: 'vacation', status_text: 'De férias até sexta' })
      .expect(200);
    return member;
  }

  type Listed = { id: string; status: unknown };

  async function get<T>(cookie: string, path: string): Promise<T> {
    const response = await request(server).get(path).set('Cookie', cookie);
    return response.body as T;
  }

  it('a Sessão e o Perfil trazem o Status', async () => {
    const ana = await withStatus();

    const session = await get<{ person: Listed }>(
      ana.cookie,
      '/v1/sessions/current',
    );
    const profile = await get<{ person: Listed }>(
      ana.cookie,
      `/v1/people/${ana.person.id}`,
    );

    expect(session.person.status).toEqual(VACATION);
    expect(profile.person.status).toEqual(VACATION);
  });

  it('a busca e os Membros trazem o Status', async () => {
    const ana = await withStatus();
    const channel = await conversationRoutes.createChannel(app);

    const search = await get<{ people: Listed[] }>(
      ana.cookie,
      `/v1/people?q=${encodeURIComponent(ana.person.username)}`,
    );
    const members = await get<{ members: Listed[] }>(
      ana.cookie,
      `/v1/conversations/${channel.id}/members`,
    );

    expect(search.people[0]).toMatchObject({
      id: ana.person.id,
      status: VACATION,
    });
    expect(
      members.members.find((member) => member.id === ana.person.id),
    ).toMatchObject({ status: VACATION });
  });

  it('o retrato traz só quem tem Status', async () => {
    const ana = await withStatus();
    const bruno = await authRoutes.loggedIn(app);

    const { people } = await get<{ people: Listed[] }>(
      bruno.cookie,
      '/v1/people/presence',
    );

    const ids = people.map((person) => person.id);
    expect(ids).toContain(ana.person.id);
    expect(ids).not.toContain(bruno.person.id);
    expect(people.find((person) => person.id === ana.person.id)).toEqual({
      id: ana.person.id,
      presence: 'away',
      status: VACATION,
    });
  });

  it('o retrato responde 401 sem Sessão', async () => {
    const response = await request(server).get('/v1/people/presence');

    expect(response.status).toBe(401);
  });
});
