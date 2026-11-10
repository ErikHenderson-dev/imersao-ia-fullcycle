import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConversationsService } from '../../src/conversations/conversations.service';
import { PeopleService } from '../../src/people/people.service';
import { Person } from '../../src/people/person.entity';
import { uniqueEmail } from './unique-email';

export const TEST_PASSWORD = 'senha-correta-123';
export const SESSION_COOKIE_NAME = 'fc_session';

export interface CreatedPerson {
  person: Person;
  email: string;
  password: string;
}

// Atalhos da base de testes: preparar Pessoa e Sessão no Arrange, sem asserção.
export const authRoutes = {
  async createPerson(
    app: INestApplication,
    overrides: { email?: string; name?: string; password?: string } = {},
  ): Promise<CreatedPerson> {
    const email = overrides.email ?? uniqueEmail();
    const password = overrides.password ?? TEST_PASSWORD;
    const person = await app.get(PeopleService).create({
      email,
      name: overrides.name ?? 'Ana Souza',
      password,
    });
    return { person, email, password };
  },

  async login(
    app: INestApplication,
    email: string,
    password: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer() as App)
      .post('/v1/sessions')
      .send({ email, password })
      .expect(201);
    return (response.body as { token: string }).token;
  },

  // Pessoa nova, já com uma Sessão.
  async loggedIn(
    app: INestApplication,
    overrides: { name?: string } = {},
  ): Promise<{ person: Person; token: string; cookie: string }> {
    const { person, email, password } = await authRoutes.createPerson(
      app,
      overrides,
    );
    const token = await authRoutes.login(app, email, password);
    return { person, token, cookie: authRoutes.sessionCookie(token) };
  },

  // Pessoa nova pelo caminho do comando de contas: já Membro de todos os Canais públicos.
  async loggedInInPublicChannels(
    app: INestApplication,
  ): Promise<{ person: Person; token: string; cookie: string }> {
    const email = uniqueEmail();
    const person = await app
      .get(ConversationsService)
      .createPersonInPublicChannels({
        email,
        name: 'Ana Souza',
        password: TEST_PASSWORD,
      });
    const token = await authRoutes.login(app, email, TEST_PASSWORD);
    return { person, token, cookie: authRoutes.sessionCookie(token) };
  },

  sessionCookie(token: string): string {
    return `${SESSION_COOKIE_NAME}=${token}`;
  },
};
