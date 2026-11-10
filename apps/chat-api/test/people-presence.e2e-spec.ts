import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import { createTestApp } from './support/create-test-app';

describe('escolha de presença', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function choose(cookie: string, body: object) {
    return request(server)
      .put('/v1/people/me/presence')
      .set('Cookie', cookie)
      .send(body);
  }

  it('grava a escolha, que volta na Sessão', async () => {
    const { cookie } = await authRoutes.loggedIn(app);

    const response = await choose(cookie, { presence_choice: 'away' });

    expect(response.status).toBe(204);
    const session = await request(server)
      .get('/v1/sessions/current')
      .set('Cookie', cookie);
    expect(
      (session.body as { person: { presence_choice: string } }).person
        .presence_choice,
    ).toBe('away');
  });

  it('começa disponível', async () => {
    const { cookie } = await authRoutes.loggedIn(app);

    const session = await request(server)
      .get('/v1/sessions/current')
      .set('Cookie', cookie);

    expect(
      (session.body as { person: { presence_choice: string } }).person
        .presence_choice,
    ).toBe('available');
  });

  it.each([
    ['um valor fora da lista', { presence_choice: 'busy' }],
    ['o corpo vazio', {}],
  ])('responde 400 validation_failed para %s', async (_case, body) => {
    const { cookie } = await authRoutes.loggedIn(app);

    const response = await choose(cookie, body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('o Perfil de quem não está conectado traz ausente', async () => {
    const { cookie, person } = await authRoutes.loggedIn(app);

    const response = await request(server)
      .get(`/v1/people/${person.id}`)
      .set('Cookie', cookie);

    expect(
      (response.body as { person: { presence: string } }).person.presence,
    ).toBe('away');
  });

  it('responde 401 sem Sessão', async () => {
    const response = await request(server)
      .put('/v1/people/me/presence')
      .send({ presence_choice: 'away' });

    expect(response.status).toBe(401);
  });
});
