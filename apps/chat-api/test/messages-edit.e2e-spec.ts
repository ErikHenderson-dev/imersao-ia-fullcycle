import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { MESSAGE_MAX_LENGTH } from '../src/messages/message-values';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type MessageBody = {
  id: string;
  body: string;
  edited_at: string | null;
};

describe('editar Mensagem', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  // Uma Mensagem do autor num Canal novo, gravada pelo REST.
  async function sentMessage(name = 'Ana Souza') {
    const author = await authRoutes.loggedIn(app, { name });
    const channel = await conversationRoutes.createChannel(app);
    const response = await conversationRoutes.sendMessage(
      app,
      author.cookie,
      channel.id,
      { body: 'Texto original' },
    );
    const message = (response.body as { message: MessageBody }).message;
    return { author, channel, message };
  }

  function edit(
    cookie: string,
    conversationId: string,
    messageId: string,
    body: unknown,
  ) {
    return request(server)
      .patch(`/v1/conversations/${conversationId}/messages/${messageId}`)
      .set('Cookie', cookie)
      .send({ body });
  }

  async function storedRow(messageId: string) {
    const [row] = await app
      .get(DataSource)
      .query<{ body: string; edited_at: Date | null }[]>(
        'SELECT body, edited_at FROM messages WHERE id = $1',
        [messageId],
      );
    return row;
  }

  it('edita o texto e grava edited_at', async () => {
    const { author, channel, message } = await sentMessage();

    const response = await edit(
      author.cookie,
      channel.id,
      message.id,
      '  Texto novo  ',
    );

    expect(response.status).toBe(200);
    const edited = (response.body as { message: MessageBody }).message;
    expect(edited).toMatchObject({ id: message.id, body: 'Texto novo' });
    expect(edited.edited_at).toEqual(expect.any(String));
    const row = await storedRow(message.id);
    expect(row.body).toBe('Texto novo');
    expect(row.edited_at?.toISOString()).toBe(edited.edited_at);
  });

  it('o histórico traz edited_at nulo antes e preenchido depois da edição', async () => {
    const { author, channel, message } = await sentMessage();
    await edit(author.cookie, channel.id, message.id, 'Texto novo').expect(200);

    const response = await request(server)
      .get(`/v1/conversations/${channel.id}/messages`)
      .set('Cookie', author.cookie);

    const [listed] = (response.body as { messages: MessageBody[] }).messages;
    expect(message.edited_at).toBeNull();
    expect(listed).toMatchObject({ id: message.id, body: 'Texto novo' });
    expect(listed.edited_at).toEqual(expect.any(String));
  });

  it('o mesmo texto não muda edited_at', async () => {
    const { author, channel, message } = await sentMessage();

    const response = await edit(
      author.cookie,
      channel.id,
      message.id,
      'Texto original',
    );

    expect(response.status).toBe(200);
    expect((response.body as { message: MessageBody }).message.edited_at).toBe(
      null,
    );
    expect((await storedRow(message.id)).edited_at).toBeNull();
  });

  it.each([
    ['vazio', '   '],
    ['acima do limite', 'a'.repeat(MESSAGE_MAX_LENGTH + 1)],
    ['sem texto', undefined],
  ])('responde 400 com o texto %s', async (_case, body) => {
    const { author, channel, message } = await sentMessage();

    const response = await edit(author.cookie, channel.id, message.id, body);

    expect(response.status).toBe(400);
    expect((await storedRow(message.id)).body).toBe('Texto original');
  });

  it('responde 403 para a Mensagem de outra Pessoa', async () => {
    const other = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const { channel, message } = await sentMessage();

    const response = await edit(other.cookie, channel.id, message.id, 'Outro');

    expect(response.status).toBe(403);
    expect((response.body as { code: string }).code).toBe('message_not_owned');
    expect((await storedRow(message.id)).body).toBe('Texto original');
  });

  it('responde 404 para Mensagem inexistente ou de id malformado', async () => {
    const { author, channel } = await sentMessage();

    const responses = await Promise.all(
      [randomUUID(), 'nao-e-uuid'].map((id) =>
        edit(author.cookie, channel.id, id, 'Texto novo'),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect((response.body as { code: string }).code).toBe(
        'message_not_found',
      );
    }
  });

  it('responde 404 para a Mensagem pelo caminho de outra Conversa', async () => {
    const { author, message } = await sentMessage();
    const otherChannel = await conversationRoutes.createChannel(app);

    const response = await edit(
      author.cookie,
      otherChannel.id,
      message.id,
      'Texto novo',
    );

    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe('message_not_found');
  });

  it('responde 404 para quem não é Membro da Conversa', async () => {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const outsider = await authRoutes.loggedIn(app, { name: 'Carla Dias' });
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    const sent = await conversationRoutes.sendMessage(
      app,
      author.cookie,
      channelId,
    );
    const messageId = (sent.body as { message: MessageBody }).message.id;

    const response = await edit(outsider.cookie, channelId, messageId, 'Oi');

    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe('message_not_found');
  });

  it('responde 401 sem Sessão', async () => {
    const { channel, message } = await sentMessage();

    const response = await request(server)
      .patch(`/v1/conversations/${channel.id}/messages/${message.id}`)
      .send({ body: 'Texto novo' });

    expect(response.status).toBe(401);
  });

  it('duas edições ao mesmo tempo terminam sem erro, com o texto de uma delas', async () => {
    const { author, channel, message } = await sentMessage();

    const responses = await Promise.all(
      ['Primeira versão', 'Segunda versão'].map((body) =>
        edit(author.cookie, channel.id, message.id, body),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(['Primeira versão', 'Segunda versão']).toContain(
      (await storedRow(message.id)).body,
    );
  });
});
