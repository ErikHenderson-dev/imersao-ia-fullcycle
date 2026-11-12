import { INestApplication } from '@nestjs/common';
import type { MessagePayload } from 'chat-events';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { PeopleService } from '../src/people/people.service';
import { authRoutes } from './support/auth-routes';
import { botRoutes, TEST_BOT_TOKEN } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import {
  collectEvents,
  listenTestApp,
  realtimeRoutes,
  settle,
  TestSocket,
  waitForCount,
} from './support/realtime-routes';

const ANSWER = 'Faturamento de março de 2026: R$ 1.234.567,89.';

// A Resposta bloqueada em tempo real e na reconexão (spec da F13, "Marca e Resposta bloqueada",
// item "WebSocket"; F13-T02, CA4).
describe('Dados de negócio em tempo real', () => {
  let app: INestApplication;
  let url: string;
  const sockets: TestSocket[] = [];

  beforeAll(async () => {
    ({ app, url } = await listenTestApp());
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  async function connected(token: string, cursor?: string) {
    const socket = await realtimeRoutes.connected(url, { token, cursor });
    sockets.push(socket);
    return socket;
  }

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
    const reply = () =>
      botRoutes.reply(app, requestId, ANSWER, TEST_BOT_TOKEN, {
        business_data: true,
      });
    return { ana, bruno, channel, reply };
  }

  async function createdWithId(
    events: { message: MessagePayload }[],
    id: string,
  ): Promise<MessagePayload> {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const found = events.find((event) => event.message.id === id);
      if (found) return found.message;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`message.created da Mensagem ${id} não chegou`);
  }

  it('a resposta marcada chega completa a quem tem permissão e bloqueada a quem não tem', async () => {
    const { ana, bruno, reply } = await scene();
    const toAna = collectEvents(await connected(ana.token), 'message.created');
    const toBruno = collectEvents(
      await connected(bruno.token),
      'message.created',
    );

    const response = await reply().expect(201);

    const { id } = (response.body as { message: { id: string } }).message;
    expect(await createdWithId(toAna, id)).toMatchObject({
      body: ANSWER,
      business_data: true,
      blocked: false,
    });
    expect(await createdWithId(toBruno, id)).toMatchObject({
      body: '',
      quick_replies: null,
      business_data: true,
      blocked: true,
    });
  });

  it('a Mensagem que cita a resposta marcada leva a citação de cada um', async () => {
    const { ana, bruno, channel, reply } = await scene();
    const answer = (
      (await reply().expect(201)).body as { message: { id: string } }
    ).message;
    const toAna = collectEvents(await connected(ana.token), 'message.created');
    const toBruno = collectEvents(
      await connected(bruno.token),
      'message.created',
    );

    const response = await request(app.getHttpServer() as App)
      .post(`/v1/conversations/${channel.id}/messages`)
      .set('Cookie', ana.cookie)
      .send({
        client_id: randomUUID(),
        body: 'Bateu a meta',
        quoted_message_id: answer.id,
      })
      .expect(201);

    const { id } = (response.body as { message: { id: string } }).message;
    expect((await createdWithId(toAna, id)).quote).toMatchObject({
      body: ANSWER,
      blocked: false,
    });
    expect((await createdWithId(toBruno, id)).quote).toMatchObject({
      body: '',
      business_data: true,
      blocked: true,
    });
  });

  it('a reconexão reenvia a versão de cada Pessoa', async () => {
    const { bruno, reply } = await scene();
    await settle();
    const first = await connected(bruno.token);
    const seen = collectEvents(first, 'sync');
    await waitForCount(seen, 1);
    const cursor = seen[0].cursor ?? undefined;
    first.disconnect();
    const answer = (
      (await reply().expect(201)).body as { message: { id: string } }
    ).message;

    await settle();
    const again = await connected(bruno.token, cursor);

    const replayed = collectEvents(again, 'message.created');
    expect(await createdWithId(replayed, answer.id)).toMatchObject({
      body: '',
      blocked: true,
    });
  });
});
