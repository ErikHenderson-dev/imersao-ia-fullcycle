import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PeopleService } from '../src/people/people.service';
import { authRoutes } from './support/auth-routes';
import { createTestApp } from './support/create-test-app';

describe('POST /v1/agents/changed', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function announce(cookie?: string) {
    const call = request(server).post('/v1/agents/changed');
    return cookie ? call.set('Cookie', cookie) : call;
  }

  it('responde 204 a um administrador', async () => {
    const { person, cookie } = await authRoutes.loggedIn(app);
    await app.get(PeopleService).setAdmin(person.id, true);

    const response = await announce(cookie);

    expect(response.status).toBe(204);
  });

  it('responde 403 forbidden a quem não administra', async () => {
    const { cookie } = await authRoutes.loggedIn(app);

    const response = await announce(cookie);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'forbidden' });
  });

  it('responde 403 a quem perdeu o papel, com a mesma Sessão', async () => {
    const { person, cookie } = await authRoutes.loggedIn(app);
    const people = app.get(PeopleService);
    await people.setAdmin(person.id, true);
    await people.setAdmin(person.id, false);

    const response = await announce(cookie);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'forbidden' });
  });

  it('responde 401 unauthenticated sem Sessão', async () => {
    const response = await announce();

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'unauthenticated' });
  });
});
