import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import { createTestApp } from './support/create-test-app';

type SessionBody = { person: { theme: string } };

describe('tema', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function save(cookie: string, body: object) {
    return request(server)
      .put('/v1/people/me/theme')
      .set('Cookie', cookie)
      .send(body);
  }

  async function themeOf(cookie: string): Promise<string> {
    const response = await request(server)
      .get('/v1/sessions/current')
      .set('Cookie', cookie);
    return (response.body as SessionBody).person.theme;
  }

  it('começa no claro', async () => {
    const { cookie } = await authRoutes.loggedIn(app);

    const theme = await themeOf(cookie);

    expect(theme).toBe('light');
  });

  it('grava o tema, que volta na Sessão', async () => {
    const { cookie } = await authRoutes.loggedIn(app);

    const response = await save(cookie, { theme: 'dark' });

    expect(response.status).toBe(204);
    expect(await themeOf(cookie)).toBe('dark');
  });

  it.each([
    ['um valor fora da lista', { theme: 'sepia' }],
    ['o corpo vazio', {}],
  ])('responde 400 validation_failed para %s', async (_case, body) => {
    const { cookie } = await authRoutes.loggedIn(app);

    const response = await save(cookie, body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('responde 401 sem Sessão', async () => {
    const response = await request(server)
      .put('/v1/people/me/theme')
      .send({ theme: 'dark' });

    expect(response.status).toBe(401);
  });
});
