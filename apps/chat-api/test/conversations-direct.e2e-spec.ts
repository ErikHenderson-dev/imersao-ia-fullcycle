import { INestApplication } from '@nestjs/common';
import { randomUUID, randomUUIDv7 } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type ConversationBody = {
  id: string;
  kind: string;
  name: string | null;
  topic: string | null;
  member_count: number;
  counterpart: { id: string; name: string; username: string } | null;
};

describe('Conversa direta', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function memberIds(conversationId: string): Promise<string[]> {
    return app
      .get(DataSource)
      .query<{ person_id: string }[]>(
        'SELECT person_id FROM conversation_members WHERE conversation_id = $1',
        [conversationId],
      )
      .then((rows) => rows.map((row) => row.person_id));
  }

  const conversationOf = (response: request.Response) =>
    (response.body as { conversation: ConversationBody }).conversation;

  it('responde 201 e grava só quem abriu', async () => {
    const opener = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const other = await authRoutes.loggedIn(app, { name: 'Regina Fonseca' });

    const response = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );

    expect(response.status).toBe(201);
    const conversation = conversationOf(response);
    expect(conversation).toEqual({
      id: conversation.id,
      kind: 'direct',
      name: null,
      topic: null,
      member_count: 1,
      counterpart: {
        id: other.person.id,
        name: 'Regina Fonseca',
        username: other.person.username,
      },
    });
    expect(await memberIds(conversation.id)).toEqual([opener.person.id]);
  });

  it('responde 200 com a mesma Conversa ao abrir de novo', async () => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const first = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );

    const response = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );

    expect(response.status).toBe(200);
    expect(conversationOf(response).id).toBe(conversationOf(first).id);
  });

  it('a outra Pessoa abre a mesma Conversa e vira Membro', async () => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const first = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );

    const response = await conversationRoutes.openDirect(
      app,
      other.cookie,
      opener.person.id,
    );

    expect(response.status).toBe(200);
    const conversation = conversationOf(response);
    expect(conversation.id).toBe(conversationOf(first).id);
    expect(conversation.counterpart?.id).toBe(opener.person.id);
    expect(conversation.member_count).toBe(2);
    expect((await memberIds(conversation.id)).sort()).toEqual(
      [opener.person.id, other.person.id].sort(),
    );
  });

  it('as duas pontas ao mesmo tempo dão numa Conversa só', async () => {
    const left = await authRoutes.loggedIn(app);
    const right = await authRoutes.loggedIn(app);

    const responses = await Promise.all([
      conversationRoutes.openDirect(app, left.cookie, right.person.id),
      conversationRoutes.openDirect(app, right.cookie, left.person.id),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 201,
    ]);
    expect(conversationOf(responses[0]).id).toBe(
      conversationOf(responses[1]).id,
    );
  });

  it('abre a Conversa consigo mesma', async () => {
    const person = await authRoutes.loggedIn(app, { name: 'Ana Souza' });

    const response = await conversationRoutes.openDirect(
      app,
      person.cookie,
      person.person.id,
    );

    expect(response.status).toBe(201);
    expect(conversationOf(response)).toMatchObject({
      member_count: 1,
      counterpart: { id: person.person.id, name: 'Ana Souza' },
    });
  });

  it('aceita o id da outra Pessoa em maiúsculas', async () => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);

    const response = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id.toUpperCase(),
    );

    expect(response.status).toBe(201);
    expect(conversationOf(response).counterpart?.id).toBe(other.person.id);
  });

  it('responde 404 person_not_found para quem não é Pessoa', async () => {
    const opener = await authRoutes.loggedIn(app);

    const response = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      randomUUIDv7(),
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'person_not_found' });
  });

  it.each([
    ['o nome junto', { name: 'dm' }],
    ['o client_id junto', { client_id: randomUUID() }],
    ['o Tópico junto', { topic: 'Tópico' }],
    ['um nome vazio escondendo o Tópico', { name: '', topic: 'Tópico' }],
  ])('responde 400 para %s', async (_case, extra) => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);

    const response = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
      extra,
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('responde 400 para o Canal com person_id', async () => {
    const opener = await authRoutes.loggedIn(app);

    const response = await conversationRoutes.createChannelByRest(
      app,
      opener.cookie,
      { kind: 'private_channel' },
    );
    const withPerson = await request(server)
      .post('/v1/conversations')
      .set('Cookie', opener.cookie)
      .send({
        kind: 'private_channel',
        name: `c-${randomUUID().slice(0, 8)}`,
        client_id: randomUUID(),
        person_id: opener.person.id,
      });

    expect(response.status).toBe(201);
    expect(withPerson.status).toBe(400);
  });

  it('a lista traz os Canais e depois as Conversas diretas pelo nome da outra Pessoa', async () => {
    const tag = randomUUID().slice(0, 8);
    const person = await authRoutes.loggedIn(app, { name: `Ana ${tag}` });
    const zeca = await authRoutes.createPerson(app, { name: `Zeca ${tag}` });
    const bruno = await authRoutes.createPerson(app, { name: `Bruno ${tag}` });
    await conversationRoutes.openDirect(app, person.cookie, zeca.person.id);
    await conversationRoutes.openDirect(app, person.cookie, bruno.person.id);
    await conversationRoutes.privateChannelOf(app, person.cookie);

    const response = await request(server)
      .get('/v1/conversations')
      .set('Cookie', person.cookie);

    const conversations = (
      response.body as { conversations: ConversationBody[] }
    ).conversations;
    const firstDirect = conversations.findIndex((c) => c.kind === 'direct');
    expect(firstDirect).toBeGreaterThan(0);
    expect(
      conversations.slice(firstDirect).every((c) => c.kind === 'direct'),
    ).toBe(true);
    expect(
      conversations
        .filter((c) => c.kind === 'direct')
        .map((c) => c.counterpart?.name),
    ).toEqual([`Bruno ${tag}`, `Zeca ${tag}`]);
    expect(
      conversations
        .filter((c) => c.kind !== 'direct')
        .every((c) => c.counterpart === null),
    ).toBe(true);
  });

  it('a Conversa traz o counterpart de quem pede', async () => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const opened = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );
    await conversationRoutes.openDirect(app, other.cookie, opener.person.id);
    const { id } = conversationOf(opened);

    const response = await request(server)
      .get(`/v1/conversations/${id}`)
      .set('Cookie', other.cookie);

    expect(conversationOf(response).counterpart?.id).toBe(opener.person.id);
  });

  it('responde 409 ao adicionar Membros', async () => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const opened = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );

    const response = await conversationRoutes.addMembers(
      app,
      opener.cookie,
      conversationOf(opened).id,
      [other.person.id],
    );

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'members_not_editable' });
  });

  it('quem não é Membro recebe 404', async () => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const opened = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );
    const { id } = conversationOf(opened);

    const responses = await Promise.all([
      request(server)
        .get(`/v1/conversations/${id}`)
        .set('Cookie', other.cookie),
      request(server)
        .get(`/v1/conversations/${id}/messages`)
        .set('Cookie', other.cookie),
      request(server)
        .get(`/v1/conversations/${id}/members`)
        .set('Cookie', other.cookie),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      404, 404, 404,
    ]);
  });
});
