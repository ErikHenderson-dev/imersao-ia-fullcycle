import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type Quote =
  | {
      id: string;
      deleted: false;
      author: { kind: string; id: string; name: string; username: string };
      body: string;
    }
  | { id: string; deleted: true };
type MessageBody = { id: string; body: string; quote: Quote | null };

describe('Citação', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  async function channelWithOriginal() {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const channel = await conversationRoutes.createChannel(app);
    const sent = await conversationRoutes
      .sendMessage(app, author.cookie, channel.id, { body: 'A original' })
      .expect(201);
    const original = (sent.body as { message: MessageBody }).message;
    return { author, channel, original };
  }

  function sendQuoting(
    cookie: string,
    conversationId: string,
    quotedMessageId: string,
    clientId = randomUUID(),
  ) {
    return request(server)
      .post(`/v1/conversations/${conversationId}/messages`)
      .set('Cookie', cookie)
      .send({
        client_id: clientId,
        body: 'A resposta',
        quoted_message_id: quotedMessageId,
      });
  }

  async function history(cookie: string, conversationId: string) {
    const response = await request(server)
      .get(`/v1/conversations/${conversationId}/messages`)
      .set('Cookie', cookie)
      .expect(200);
    return (response.body as { messages: MessageBody[] }).messages;
  }

  it('envia com Citação e devolve a quote', async () => {
    const { author, channel, original } = await channelWithOriginal();

    const response = await sendQuoting(author.cookie, channel.id, original.id);

    expect(response.status).toBe(201);
    expect((response.body as { message: MessageBody }).message.quote).toEqual({
      id: original.id,
      deleted: false,
      author: {
        kind: 'person',
        id: author.person.id,
        name: 'Ana Souza',
        username: author.person.username,
      },
      body: 'A original',
    });
  });

  it('cita uma Mensagem de bot, com o autor bot', async () => {
    const author = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const botMessageId = await conversationRoutes.insertBotMessage(app, {
      conversationId: channel.id,
      botId: bot.id,
      body: 'Resumo de hoje',
    });

    const response = await sendQuoting(author.cookie, channel.id, botMessageId);

    expect(response.status).toBe(201);
    expect((response.body as { message: MessageBody }).message.quote).toEqual({
      id: botMessageId,
      deleted: false,
      author: {
        kind: 'bot',
        id: bot.id,
        name: 'Assistente',
        username: bot.username,
      },
      body: 'Resumo de hoje',
    });
  });

  it('recusa a Citação de outra Conversa, inexistente ou apagada', async () => {
    const { author, channel, original } = await channelWithOriginal();
    const other = await conversationRoutes.createChannel(app);
    const deleted = await conversationRoutes
      .sendMessage(app, author.cookie, channel.id, { body: 'Vai sumir' })
      .expect(201);
    const deletedId = (deleted.body as { message: MessageBody }).message.id;
    await conversationRoutes
      .deleteMessage(app, author.cookie, channel.id, deletedId)
      .expect(204);

    const responses = await Promise.all([
      sendQuoting(author.cookie, other.id, original.id),
      sendQuoting(author.cookie, channel.id, randomUUID()),
      sendQuoting(author.cookie, channel.id, deletedId),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect((response.body as { code: string }).code).toBe(
        'quoted_message_not_found',
      );
    }
  });

  it('recusa a Citação com id malformado', async () => {
    const { author, channel } = await channelWithOriginal();

    const response = await sendQuoting(author.cookie, channel.id, 'nao-e-uuid');

    expect(response.status).toBe(400);
  });

  it('o reenvio não muda a Citação', async () => {
    const { author, channel, original } = await channelWithOriginal();
    const clientId = randomUUID();
    await sendQuoting(author.cookie, channel.id, original.id, clientId).expect(
      201,
    );
    await conversationRoutes
      .deleteMessage(app, author.cookie, channel.id, original.id)
      .expect(204);

    const again = await sendQuoting(
      author.cookie,
      channel.id,
      randomUUID(),
      clientId,
    );

    expect(again.status).toBe(201);
    expect((again.body as { message: MessageBody }).message.quote).toEqual({
      id: original.id,
      deleted: true,
    });
  });

  it('a quote mostra o texto editado e a marca de apagada no histórico', async () => {
    const { author, channel, original } = await channelWithOriginal();
    await sendQuoting(author.cookie, channel.id, original.id).expect(201);
    await conversationRoutes
      .editMessage(
        app,
        author.cookie,
        channel.id,
        original.id,
        'A original, editada',
      )
      .expect(200);

    const afterEdit = await history(author.cookie, channel.id);
    await conversationRoutes
      .deleteMessage(app, author.cookie, channel.id, original.id)
      .expect(204);
    const afterDelete = await history(author.cookie, channel.id);

    expect(afterEdit.at(-1)?.quote).toMatchObject({
      body: 'A original, editada',
    });
    expect(afterDelete.map((message) => message.quote)).toEqual([
      { id: original.id, deleted: true },
    ]);
  });
});
