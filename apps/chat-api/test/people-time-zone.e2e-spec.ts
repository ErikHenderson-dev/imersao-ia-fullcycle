import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import { createTestApp } from './support/create-test-app';

describe('fuso da Pessoa', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function saveTimeZone(cookie: string, body: object) {
    return request(server)
      .put('/v1/people/me/time-zone')
      .set('Cookie', cookie)
      .send(body);
  }

  function profileOf(cookie: string, id: string) {
    return request(server).get(`/v1/people/${id}`).set('Cookie', cookie);
  }

  it('responde 204 e grava o fuso', async () => {
    const { person, cookie } = await authRoutes.loggedIn(app);

    const response = await saveTimeZone(cookie, {
      time_zone: 'America/Manaus',
    });

    expect(response.status).toBe(204);
    expect((await profileOf(cookie, person.id)).body).toMatchObject({
      person: { time_zone: 'America/Manaus' },
    });
  });

  it('responde 204 ao gravar o mesmo fuso', async () => {
    const { cookie } = await authRoutes.loggedIn(app);
    await saveTimeZone(cookie, { time_zone: 'Asia/Tokyo' });

    const response = await saveTimeZone(cookie, { time_zone: 'Asia/Tokyo' });

    expect(response.status).toBe(204);
  });

  it.each([
    ['um fuso que não existe', { time_zone: 'Lua/Crateras' }],
    ['um texto vazio', { time_zone: '' }],
    ['a falta do campo', {}],
    ['um texto longo demais', { time_zone: 'A'.repeat(65) }],
  ])('responde 400 validation_failed para %s', async (_case, body) => {
    const { cookie } = await authRoutes.loggedIn(app);

    const response = await saveTimeZone(cookie, body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('responde 401 sem Sessão', async () => {
    const response = await request(server)
      .put('/v1/people/me/time-zone')
      .send({ time_zone: 'Asia/Tokyo' });

    expect(response.status).toBe(401);
  });

  it('a Sessão devolve o fuso gravado', async () => {
    const { cookie } = await authRoutes.loggedIn(app);
    await saveTimeZone(cookie, { time_zone: 'Europe/Lisbon' });

    const response = await request(server)
      .get('/v1/sessions/current')
      .set('Cookie', cookie);

    expect(response.body).toMatchObject({
      person: { time_zone: 'Europe/Lisbon' },
    });
  });
});
