import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import { botRoutes } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type MessageBody = {
  id: string;
  conversation_id: string;
  author: { kind: string; id: string; name: string; username: string };
  body: string;
};

// A resposta do bot pelas rotas /v1/bot (spec da F11, "Rotas do bot e credencial"; F11-T03, CA2).
describe('POST /v1/bot/requests/:id/reply', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function openRequest() {
    const member = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const requestId = await botRoutes.openedRequestId(
      app,
      member.cookie,
      channel.id,
      bot.username,
    );
    return { member, channel, bot, requestId };
  }

  it.each([
    ['sem a credencial', null],
    ['com a credencial errada', 'credencial-errada'],
  ])('responde 401 invalid_bot_token %s', async (_case, token) => {
    const { requestId } = await openRequest();

    const response = await botRoutes.reply(app, requestId, 'Olá', token);

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect((response.body as { code: string }).code).toBe('invalid_bot_token');
  });

  it('grava a resposta como bot na Conversa do Pedido', async () => {
    const { member, channel, bot, requestId } = await openRequest();

    const response = await botRoutes.reply(app, requestId, '  Olá, pessoal.  ');

    expect(response.status).toBe(201);
    const { message } = response.body as { message: MessageBody };
    expect(message).toMatchObject({
      conversation_id: channel.id,
      author: {
        kind: 'bot',
        id: bot.id,
        name: 'Assistente',
        username: bot.username,
      },
      body: 'Olá, pessoal.',
    });
    const history = await request(app.getHttpServer() as App)
      .get(`/v1/conversations/${channel.id}/messages`)
      .set('Cookie', member.cookie)
      .expect(200);
    expect(
      (history.body as { messages: MessageBody[] }).messages.map((m) => m.id),
    ).toContain(message.id);
  });

  it('repetir devolve a mesma Mensagem', async () => {
    const { channel, requestId } = await openRequest();
    const first = await botRoutes.reply(app, requestId, 'Primeira').expect(201);

    const again = await botRoutes.reply(app, requestId, 'Segunda');

    expect(again.status).toBe(201);
    expect((again.body as { message: MessageBody }).message).toEqual(
      (first.body as { message: MessageBody }).message,
    );
    expect(
      await botRoutes.countMessages(app, channel.id, { botOnly: true }),
    ).toBe(1);
  });

  it.each([
    ['desconhecido', randomUUID()],
    ['malformado', 'nao-e-um-uuid'],
  ])('responde 404 request_not_found com id %s', async (_case, id) => {
    const response = await botRoutes.reply(app, id, 'Olá');

    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe('request_not_found');
  });

  it('responde 410 request_expired depois da validade', async () => {
    const { channel, requestId } = await openRequest();
    await botRoutes.updateRequest(app, requestId, {
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await botRoutes.reply(app, requestId, 'Olá');

    expect(response.status).toBe(410);
    expect((response.body as { code: string }).code).toBe('request_expired');
    expect(
      await botRoutes.countMessages(app, channel.id, { botOnly: true }),
    ).toBe(0);
  });

  it.each(['failed', 'cancelled'])(
    'responde 409 request_closed com o Pedido %s',
    async (status) => {
      const { channel, requestId } = await openRequest();
      await botRoutes.updateRequest(app, requestId, { status });

      const response = await botRoutes.reply(app, requestId, 'Olá');

      expect(response.status).toBe(409);
      expect((response.body as { code: string }).code).toBe('request_closed');
      expect(
        await botRoutes.countMessages(app, channel.id, { botOnly: true }),
      ).toBe(0);
    },
  );
});
