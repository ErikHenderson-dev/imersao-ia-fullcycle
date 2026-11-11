import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { agingRoutes, daysAgo } from './support/aging-routes';
import { PeopleService } from '../src/people/people.service';
import { authRoutes } from './support/auth-routes';
import { createTestApp } from './support/create-test-app';
import { uniqueEmail } from './support/unique-email';

describe('sessões', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function sessionRowsOf(
    personId: string,
  ): Promise<{ expires_at: Date; last_used_at: Date }[]> {
    return app
      .get(DataSource)
      .query(
        'SELECT expires_at, last_used_at FROM sessions WHERE person_id = $1',
        [personId],
      );
  }

  describe('POST /v1/sessions', () => {
    it('responde 201 com o token e a Pessoa e grava só o hash do token', async () => {
      const { person, email, password } = await authRoutes.createPerson(app, {
        name: 'Ana Souza',
      });

      const response = await request(server)
        .post('/v1/sessions')
        .send({ email, password });

      expect(response.status).toBe(201);
      const body = response.body as { token: string; person: unknown };
      expect(body.person).toEqual({
        id: person.id,
        name: 'Ana Souza',
        email,
        username: person.username,
        time_zone: null,
        status: null,
        presence_choice: 'available',
        theme: 'light',
        is_admin: false,
      });
      const rows = await app
        .get(DataSource)
        .query<{ token_hash: string }[]>(
          'SELECT token_hash FROM sessions WHERE person_id = $1',
          [person.id],
        );
      const tokenHash = createHash('sha256').update(body.token).digest('hex');
      expect(rows).toEqual([{ token_hash: tokenHash }]);
    });

    it('aceita o e-mail com maiúsculas e espaços nas pontas', async () => {
      const email = uniqueEmail();
      const { password } = await authRoutes.createPerson(app, {
        email: email.toUpperCase(),
      });

      const response = await request(server)
        .post('/v1/sessions')
        .send({ email: `  ${email.toUpperCase()} `, password });

      expect(response.status).toBe(201);
      expect(
        (response.body as { person: { email: string } }).person.email,
      ).toBe(email);
    });

    it('responde 401 invalid_credentials com o mesmo corpo para e-mail sem conta e senha errada', async () => {
      const { email } = await authRoutes.createPerson(app);

      const [unknownEmail, wrongPassword] = await Promise.all([
        request(server)
          .post('/v1/sessions')
          .send({ email: uniqueEmail(), password: 'qualquer-senha' }),
        request(server)
          .post('/v1/sessions')
          .send({ email, password: 'senha-errada' }),
      ]);

      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.body).toMatchObject({ code: 'invalid_credentials' });
      expect(wrongPassword.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it.each([
      ['e-mail fora do formato', { email: 'nao-e-email', password: 'x' }],
      ['senha vazia', { email: 'ana@teste.local', password: '' }],
      [
        'e-mail com 255 caracteres',
        { email: `${'a'.repeat(243)}@teste.local`, password: 'x' },
      ],
      [
        'senha com 257 caracteres',
        { email: 'ana@teste.local', password: 'a'.repeat(257) },
      ],
    ])(
      'responde 400 validation_failed para entrada inválida: %s',
      async (_case, body) => {
        const response = await request(server).post('/v1/sessions').send(body);

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ code: 'validation_failed' });
      },
    );
  });

  describe('GET /v1/sessions/current', () => {
    it('responde 200 com a Pessoa da Sessão', async () => {
      const { person, email, password } = await authRoutes.createPerson(app);
      const token = await authRoutes.login(app, email, password);

      const response = await request(server)
        .get('/v1/sessions/current')
        .set('Cookie', authRoutes.sessionCookie(token));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        person: {
          id: person.id,
          name: person.name,
          email,
          username: person.username,
          time_zone: null,
          status: null,
          presence_choice: 'available',
          theme: 'light',
          is_admin: false,
        },
      });
    });

    it('traz is_admin lido do banco a cada requisição', async () => {
      const { person, email, password } = await authRoutes.createPerson(app);
      const token = await authRoutes.login(app, email, password);
      await app.get(PeopleService).setAdmin(person.id, true);

      const response = await request(server)
        .get('/v1/sessions/current')
        .set('Cookie', authRoutes.sessionCookie(token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ person: { is_admin: true } });
    });

    it('responde 401 unauthenticated sem cookie', async () => {
      const response = await request(server).get('/v1/sessions/current');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'unauthenticated' });
    });

    it('renova a validade quando passou o intervalo de renovação', async () => {
      const { person, email, password } = await authRoutes.createPerson(app);
      const token = await authRoutes.login(app, email, password);
      await agingRoutes.ageSession(app, token, {
        lastUsedAt: daysAgo(2),
        expiresAt: daysAgo(-28),
      });

      const response = await request(server)
        .get('/v1/sessions/current')
        .set('Cookie', authRoutes.sessionCookie(token));

      expect(response.status).toBe(200);
      const [row] = await sessionRowsOf(person.id);
      const ttlDays = app
        .get(ConfigService)
        .getOrThrow<number>('SESSION_TTL_DAYS');
      const expectedExpiry = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
      expect(Math.abs(row.expires_at.getTime() - expectedExpiry)).toBeLessThan(
        10_000,
      );
      expect(Math.abs(row.last_used_at.getTime() - Date.now())).toBeLessThan(
        10_000,
      );
    });

    it('não renova antes do intervalo de renovação', async () => {
      const { person, email, password } = await authRoutes.createPerson(app);
      const token = await authRoutes.login(app, email, password);
      const [before] = await sessionRowsOf(person.id);

      const response = await request(server)
        .get('/v1/sessions/current')
        .set('Cookie', authRoutes.sessionCookie(token));

      expect(response.status).toBe(200);
      const [after] = await sessionRowsOf(person.id);
      expect(after.expires_at).toEqual(before.expires_at);
      expect(after.last_used_at).toEqual(before.last_used_at);
    });

    it('responde 401 e apaga a Sessão vencida', async () => {
      const { person, email, password } = await authRoutes.createPerson(app);
      const token = await authRoutes.login(app, email, password);
      await agingRoutes.ageSession(app, token, { expiresAt: daysAgo(1) });

      const response = await request(server)
        .get('/v1/sessions/current')
        .set('Cookie', authRoutes.sessionCookie(token));

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'unauthenticated' });
      expect(await sessionRowsOf(person.id)).toEqual([]);
    });

    it('responde 401 unauthenticated com token desconhecido', async () => {
      const response = await request(server)
        .get('/v1/sessions/current')
        .set('Cookie', authRoutes.sessionCookie('token-desconhecido'));

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'unauthenticated' });
    });
  });

  describe('DELETE /v1/sessions/current', () => {
    it('responde 204 e apaga só a Sessão apresentada', async () => {
      const { email, password } = await authRoutes.createPerson(app);
      const first = await authRoutes.login(app, email, password);
      const second = await authRoutes.login(app, email, password);

      const response = await request(server)
        .delete('/v1/sessions/current')
        .set('Cookie', authRoutes.sessionCookie(first));

      expect(response.status).toBe(204);
      const firstCheck = await request(server)
        .get('/v1/sessions/current')
        .set('Cookie', authRoutes.sessionCookie(first));
      expect(firstCheck.status).toBe(401);
      const secondCheck = await request(server)
        .get('/v1/sessions/current')
        .set('Cookie', authRoutes.sessionCookie(second));
      expect(secondCheck.status).toBe(200);
    });

    it('responde 401 unauthenticated ao sair sem Sessão', async () => {
      const response = await request(server).delete('/v1/sessions/current');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'unauthenticated' });
    });
  });
});
