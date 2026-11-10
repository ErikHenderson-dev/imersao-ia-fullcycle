import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type Listed = {
  id: string;
  last_read_message_id: string | null;
  unread_count: number;
  mention_count: number;
};

// Ler a Conversa (spec da F07, "Rotas", PUT /v1/conversations/:id/read).
describe('leitura da Conversa', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function read(cookie: string, conversationId: string, messageId: unknown) {
    return request(server)
      .put(`/v1/conversations/${conversationId}/read`)
      .set('Cookie', cookie)
      .send({ message_id: messageId });
  }

  async function send(cookie: string, conversationId: string, body: string) {
    const response = await conversationRoutes
      .sendMessage(app, cookie, conversationId, { body })
      .expect(201);
    return (response.body as { message: { id: string } }).message.id;
  }

  // Um Canal privado com a Pessoa que lê e uma autora que escreve, já com Mensagens dela.
  async function channelWithUnread(bodies: string[]) {
    const author = await authRoutes.loggedIn(app);
    const reader = await authRoutes.loggedIn(app);
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [reader.person.id])
      .expect(200);
    const ids: string[] = [];
    for (const body of bodies)
      ids.push(await send(author.cookie, channelId, body));
    return { author, reader, channelId, ids };
  }

  it('grava a leitura e zera os números', async () => {
    const { reader, channelId, ids } = await channelWithUnread(['Uma', 'Duas']);

    const response = await read(reader.cookie, channelId, ids[1]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      conversation_id: channelId,
      last_read_message_id: ids[1],
      unread_count: 0,
      mention_count: 0,
    });
    expect(
      await conversationRoutes.listed<Listed>(app, reader.cookie, channelId),
    ).toMatchObject({ last_read_message_id: ids[1], unread_count: 0 });
  });

  it('uma posição anterior não volta a Última leitura', async () => {
    const { reader, channelId, ids } = await channelWithUnread([
      'Uma',
      'Duas',
      'Três',
    ]);
    await read(reader.cookie, channelId, ids[1]).expect(200);

    const response = await read(reader.cookie, channelId, ids[0]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      conversation_id: channelId,
      last_read_message_id: ids[1],
      unread_count: 1,
      mention_count: 0,
    });
  });

  it('a Mensagem apagada vale como posição', async () => {
    const { author, reader, channelId, ids } = await channelWithUnread([
      'Uma',
      'Duas',
    ]);
    await conversationRoutes
      .deleteMessage(app, author.cookie, channelId, ids[1])
      .expect(204);

    const response = await read(reader.cookie, channelId, ids[1]);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      last_read_message_id: ids[1],
      unread_count: 0,
    });
  });

  it('responde 404 para Mensagem inexistente ou de outra Conversa', async () => {
    const { author, reader, channelId } = await channelWithUnread(['Uma']);
    const other = await conversationRoutes.privateChannelOf(app, author.cookie);
    const elsewhere = await send(author.cookie, other, 'Em outro Canal');

    const [missing, foreign] = await Promise.all([
      read(reader.cookie, channelId, randomUUID()),
      read(reader.cookie, channelId, elsewhere),
    ]);

    for (const response of [missing, foreign]) {
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ code: 'message_not_found' });
    }
  });

  it('responde 404 para quem não é Membro', async () => {
    const { channelId, ids } = await channelWithUnread(['Uma']);
    const outsider = await authRoutes.loggedIn(app);

    const response = await read(outsider.cookie, channelId, ids[0]);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'conversation_not_found' });
  });

  it('responde 400 sem uuid', async () => {
    const { reader, channelId } = await channelWithUnread(['Uma']);

    const response = await read(reader.cookie, channelId, 'nao-e-uuid');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('responde 401 sem Sessão', async () => {
    const response = await request(server)
      .put(`/v1/conversations/${randomUUID()}/read`)
      .send({ message_id: randomUUID() });

    expect(response.status).toBe(401);
  });
});
