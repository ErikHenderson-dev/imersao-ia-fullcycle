import { INestApplication } from '@nestjs/common';
import { authRoutes } from './support/auth-routes';
import { botRoutes } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import {
  collectEvents,
  listenTestApp,
  realtimeRoutes,
  settle,
  TestSocket,
  waitForCount,
} from './support/realtime-routes';

// A resposta do bot em tempo real (spec da F11, "Decisões de teste"; F11-T03, CA2).
describe('Resposta do bot em tempo real', () => {
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

  it('a resposta do bot chega como message.created aos Membros, uma vez só', async () => {
    const author = await authRoutes.loggedIn(app);
    const reader = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const requestId = await botRoutes.openedRequestId(
      app,
      author.cookie,
      channel.id,
      bot.username,
    );
    const socket = await realtimeRoutes.connected(url, { token: reader.token });
    sockets.push(socket);
    const received = collectEvents(socket, 'message.created');
    await botRoutes.reply(app, requestId, 'Resumo de hoje').expect(201);

    await botRoutes.reply(app, requestId, 'De novo').expect(201);

    const [event] = await waitForCount(received, 1);
    await settle();
    expect(received).toHaveLength(1);
    expect(event.message).toMatchObject({
      conversation_id: channel.id,
      body: 'Resumo de hoje',
      author: { kind: 'bot', id: bot.id, username: bot.username },
    });
  });
});
