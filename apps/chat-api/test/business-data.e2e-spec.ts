import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { PeopleService } from '../src/people/people.service';
import { authRoutes } from './support/auth-routes';
import { botRoutes, TEST_BOT_TOKEN } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type MessageBody = {
  id: string;
  author: { kind: string; name: string };
  body: string;
  created_at: string;
  business_data: boolean;
  blocked: boolean;
  quick_replies: unknown;
  quote: {
    id: string;
    deleted: boolean;
    body?: string;
    business_data?: boolean;
    blocked?: boolean;
  } | null;
};

const ANSWER = 'Faturamento de março de 2026: R$ 1.234.567,89.';

// A marca "dados de negócio" e a Resposta bloqueada (spec da F13, "Marca e Resposta bloqueada";
// F13-T02, CA2, CA3 e CA6).
describe('Dados de negócio na Mensagem', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  // A Ana tem Permissão de dados; o Bruno, não.
  async function scene() {
    const ana = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const bruno = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    await app.get(PeopleService).setDataAccess(ana.person.id, true);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const requestId = await botRoutes.openedRequestId(
      app,
      ana.cookie,
      channel.id,
      bot.username,
    );
    return { ana, bruno, channel, bot, requestId };
  }

  function replyWith(requestId: string, payload: object): request.Test {
    return request(server)
      .post(`/v1/bot/requests/${requestId}/reply`)
      .set('Authorization', `Bearer ${TEST_BOT_TOKEN}`)
      .send(payload);
  }

  async function markedAnswer(requestId: string): Promise<MessageBody> {
    const response = await replyWith(requestId, {
      body: ANSWER,
      business_data: true,
    }).expect(201);
    return (response.body as { message: MessageBody }).message;
  }

  async function historyOf(cookie: string, conversationId: string) {
    const response = await conversationRoutes
      .listMessages(app, cookie, conversationId)
      .expect(200);
    return (response.body as { messages: MessageBody[] }).messages;
  }

  async function businessDataOf(messageId: string): Promise<boolean> {
    const [row] = await app
      .get(DataSource)
      .query<{ business_data: boolean }[]>(
        'SELECT business_data FROM messages WHERE id = $1',
        [messageId],
      );
    return row.business_data;
  }

  it('reply com business_data grava a marca', async () => {
    const { requestId } = await scene();

    const response = await replyWith(requestId, {
      body: ANSWER,
      business_data: true,
    });

    expect(response.status).toBe(201);
    const { message } = response.body as { message: MessageBody };
    expect(message).toMatchObject({
      body: ANSWER,
      business_data: true,
      blocked: false,
    });
    expect(await businessDataOf(message.id)).toBe(true);
  });

  it('reply sem business_data grava sem a marca', async () => {
    const { requestId } = await scene();

    const response = await replyWith(requestId, { body: 'Resumo de hoje.' });

    expect(response.status).toBe(201);
    const { message } = response.body as { message: MessageBody };
    expect(message).toMatchObject({ business_data: false, blocked: false });
    expect(await businessDataOf(message.id)).toBe(false);
  });

  it('question com business_data grava a marca', async () => {
    const { requestId } = await scene();

    const response = await botRoutes.question(app, requestId, {
      body: 'Qual Ana?',
      quick_replies: ['Ana Beatriz Costa', 'Ana Paula Ramos'],
      business_data: true,
    });

    expect(response.status).toBe(201);
    const { message } = response.body as { message: MessageBody };
    expect(message.business_data).toBe(true);
    expect(await businessDataOf(message.id)).toBe(true);
  });

  it('recusa business_data que não é booleano', async () => {
    const { requestId } = await scene();

    const response = await replyWith(requestId, {
      body: ANSWER,
      business_data: 'sim',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('Mensagem de Pessoa nunca tem a marca', async () => {
    const { ana, channel } = await scene();

    const response = await request(server)
      .post(`/v1/conversations/${channel.id}/messages`)
      .set('Cookie', ana.cookie)
      .send({ client_id: randomUUID(), body: 'Oi', business_data: true });

    expect(response.status).toBe(201);
    const { message } = response.body as { message: MessageBody };
    expect(message.business_data).toBe(false);
    expect(await businessDataOf(message.id)).toBe(false);
  });

  it('o histórico bloqueia a resposta para quem não tem Permissão de dados', async () => {
    const { ana, bruno, channel, requestId } = await scene();
    const answer = await markedAnswer(requestId);

    const [forAna, forBruno] = await Promise.all([
      historyOf(ana.cookie, channel.id),
      historyOf(bruno.cookie, channel.id),
    ]);

    expect(forAna.find((m) => m.id === answer.id)).toMatchObject({
      body: ANSWER,
      business_data: true,
      blocked: false,
    });
    expect(forBruno.find((m) => m.id === answer.id)).toMatchObject({
      author: { kind: 'bot', name: 'Assistente' },
      created_at: answer.created_at,
      body: '',
      quick_replies: null,
      business_data: true,
      blocked: true,
    });
  });

  it('a citação de uma resposta marcada sai bloqueada no histórico e na Atividade', async () => {
    const { ana, bruno, channel, requestId } = await scene();
    const answer = await markedAnswer(requestId);
    const sent = await request(server)
      .post(`/v1/conversations/${channel.id}/messages`)
      .set('Cookie', ana.cookie)
      .send({
        client_id: randomUUID(),
        body: `@${bruno.person.username} olha isso`,
        quoted_message_id: answer.id,
      })
      .expect(201);
    const quoting = (sent.body as { message: MessageBody }).message;

    const [forAna, forBruno, activity] = await Promise.all([
      historyOf(ana.cookie, channel.id),
      historyOf(bruno.cookie, channel.id),
      request(server).get('/v1/activity').set('Cookie', bruno.cookie),
    ]);

    expect(forAna.find((m) => m.id === quoting.id)?.quote).toMatchObject({
      id: answer.id,
      body: ANSWER,
      business_data: true,
      blocked: false,
    });
    const blockedQuote = {
      id: answer.id,
      deleted: false,
      body: '',
      business_data: true,
      blocked: true,
    };
    expect(forBruno.find((m) => m.id === quoting.id)?.quote).toMatchObject(
      blockedQuote,
    );
    const items = (activity.body as { items: { message?: MessageBody }[] })
      .items;
    expect(
      items.find((item) => item.message?.id === quoting.id)?.message?.quote,
    ).toMatchObject(blockedQuote);
  });

  it('a rota do bot devolve a resposta completa', async () => {
    const { requestId } = await scene();

    const response = await replyWith(requestId, {
      body: ANSWER,
      business_data: true,
    });

    expect((response.body as { message: MessageBody }).message).toMatchObject({
      body: ANSWER,
      blocked: false,
    });
  });

  it('tirar a Permissão de dados bloqueia a próxima leitura', async () => {
    const { bruno, channel, requestId } = await scene();
    const answer = await markedAnswer(requestId);
    const people = app.get(PeopleService);
    await people.setDataAccess(bruno.person.id, true);
    await people.setDataAccess(bruno.person.id, false);

    const forBruno = await historyOf(bruno.cookie, channel.id);

    expect(forBruno.find((m) => m.id === answer.id)).toMatchObject({
      body: '',
      blocked: true,
    });
  });
});
