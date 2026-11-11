import { INestApplication } from '@nestjs/common';
import { randomUUIDv7 } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { PeopleService } from '../src/people/people.service';
import { authRoutes } from './support/auth-routes';
import { createTestApp } from './support/create-test-app';
import { uniqueEmail } from './support/unique-email';

describe('Perfil de uma Pessoa', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function profileOf(cookie: string, id: string) {
    return request(server).get(`/v1/people/${id}`).set('Cookie', cookie);
  }

  it('responde 200 com o Perfil completo', async () => {
    const { cookie } = await authRoutes.loggedIn(app);
    const email = uniqueEmail();
    const other = await app.get(PeopleService).create({
      email,
      name: 'Regina Fonseca',
      password: 'senha-da-regina',
      title: 'Engenheira de Software',
      phone: '+55 11 98888-0001',
    });

    const response = await profileOf(cookie, other.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      person: {
        id: other.id,
        name: 'Regina Fonseca',
        username: other.username,
        title: 'Engenheira de Software',
        email,
        phone: '+55 11 98888-0001',
        time_zone: null,
        status: null,
        is_admin: false,
        presence: 'away',
      },
    });
  });

  it('traz is_admin no Perfil de quem administra', async () => {
    const { cookie } = await authRoutes.loggedIn(app);
    const { person } = await authRoutes.createPerson(app);
    await app.get(PeopleService).setAdmin(person.id, true);

    const response = await profileOf(cookie, person.id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ person: { is_admin: true } });
  });

  it('responde 200 com cargo, telefone e fuso nulos', async () => {
    const { cookie } = await authRoutes.loggedIn(app);
    const { person } = await authRoutes.createPerson(app);

    const response = await profileOf(cookie, person.id);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      person: { id: person.id, title: null, phone: null, time_zone: null },
    });
  });

  it.each([
    ['um id malformado', 'nao-e-uuid'],
    ['um id que não é de Pessoa', randomUUIDv7()],
  ])('responde 404 person_not_found para %s', async (_case, id) => {
    const { cookie } = await authRoutes.loggedIn(app);

    const response = await profileOf(cookie, id);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'person_not_found' });
  });

  it('responde 401 sem Sessão', async () => {
    const { person } = await authRoutes.createPerson(app);

    const response = await request(server).get(`/v1/people/${person.id}`);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'unauthenticated' });
  });
});
