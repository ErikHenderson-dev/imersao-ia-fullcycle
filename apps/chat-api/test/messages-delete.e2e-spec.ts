import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type MessageBody = { id: string };

describe('apagar Mensagem', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  async function sentMessage() {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const channel = await conversationRoutes.createChannel(app);
    const response = await conversationRoutes.sendMessage(
      app,
      author.cookie,
      channel.id,
      { body: 'Vai sumir' },
    );
    const message = (response.body as { message: MessageBody }).message;
    return { author, channel, message };
  }

  function remove(cookie: string, conversationId: string, messageId: string) {
    return conversationRoutes.deleteMessage(
      app,
      cookie,
      conversationId,
      messageId,
    );
  }

  async function storedRow(messageId: string) {
    const [row] = await app
      .get(DataSource)
      .query<{ body: string | null; deleted_at: Date | null }[]>(
        'SELECT body, deleted_at FROM messages WHERE id = $1',
        [messageId],
      );
    return row;
  }

  it('apaga, zera o texto e grava deleted_at', async () => {
    const { author, channel, message } = await sentMessage();

    const response = await remove(author.cookie, channel.id, message.id);

    expect(response.status).toBe(204);
    const row = await storedRow(message.id);
    expect(row.body).toBeNull();
    expect(row.deleted_at).toBeInstanceOf(Date);
  });

  it('o histórico não traz a Mensagem apagada', async () => {
    const { author, channel, message } = await sentMessage();
    await remove(author.cookie, channel.id, message.id).expect(204);

    const response = await request(server)
      .get(`/v1/conversations/${channel.id}/messages`)
      .set('Cookie', author.cookie);

    expect(response.status).toBe(200);
    expect((response.body as { messages: MessageBody[] }).messages).toEqual([]);
  });

  it('apagar de novo responde 404', async () => {
    const { author, channel, message } = await sentMessage();
    await remove(author.cookie, channel.id, message.id).expect(204);

    const response = await remove(author.cookie, channel.id, message.id);

    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe('message_not_found');
  });

  it('editar a Mensagem apagada responde 404', async () => {
    const { author, channel, message } = await sentMessage();
    await remove(author.cookie, channel.id, message.id).expect(204);

    const response = await conversationRoutes.editMessage(
      app,
      author.cookie,
      channel.id,
      message.id,
      'Volta?',
    );

    expect(response.status).toBe(404);
    expect((await storedRow(message.id)).body).toBeNull();
  });

  it('responde 403 para a Mensagem de outra Pessoa', async () => {
    const other = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const { channel, message } = await sentMessage();

    const response = await remove(other.cookie, channel.id, message.id);

    expect(response.status).toBe(403);
    expect((response.body as { code: string }).code).toBe('message_not_owned');
    expect((await storedRow(message.id)).deleted_at).toBeNull();
  });

  it('responde 403 ao apagar a Mensagem de um bot', async () => {
    const member = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app);
    const messageId = await conversationRoutes.insertBotMessage(app, {
      conversationId: channel.id,
      botId: bot.id,
    });

    const response = await remove(member.cookie, channel.id, messageId);

    expect(response.status).toBe(403);
    expect((response.body as { code: string }).code).toBe('message_not_owned');
    expect((await storedRow(messageId)).deleted_at).toBeNull();
  });

  it('responde 404 para Mensagem inexistente, de outra Conversa ou de quem não é Membro', async () => {
    const outsider = await authRoutes.loggedIn(app, { name: 'Carla Dias' });
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const privateId = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    const sent = await conversationRoutes.sendMessage(
      app,
      author.cookie,
      privateId,
    );
    const messageId = (sent.body as { message: MessageBody }).message.id;
    const otherChannel = await conversationRoutes.createChannel(app);

    const responses = await Promise.all([
      remove(author.cookie, privateId, randomUUID()),
      remove(author.cookie, otherChannel.id, messageId),
      remove(outsider.cookie, privateId, messageId),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect((response.body as { code: string }).code).toBe(
        'message_not_found',
      );
    }
    expect((await storedRow(messageId)).deleted_at).toBeNull();
  });

  it('responde 401 sem Sessão', async () => {
    const { channel, message } = await sentMessage();

    const response = await request(server).delete(
      `/v1/conversations/${channel.id}/messages/${message.id}`,
    );

    expect(response.status).toBe(401);
  });

  it('editar e apagar ao mesmo tempo terminam sem erro do banco', async () => {
    const { author, channel, message } = await sentMessage();

    const [edited, removed] = await Promise.all([
      conversationRoutes.editMessage(
        app,
        author.cookie,
        channel.id,
        message.id,
        'Edição concorrente',
      ),
      remove(author.cookie, channel.id, message.id),
    ]);

    expect([200, 404]).toContain(edited.status);
    expect(removed.status).toBe(204);
    const row = await storedRow(message.id);
    expect(row.body).toBeNull();
    expect(row.deleted_at).toBeInstanceOf(Date);
  });
});
