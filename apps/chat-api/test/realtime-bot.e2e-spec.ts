import { INestApplication } from '@nestjs/common';
import { authRoutes } from './support/auth-routes';
import { botRoutes } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import {
  collectEvents,
  listenTestApp,
  openConversation,
  realtimeRoutes,
  settle,
  TestSocket,
  waitForCount,
} from './support/realtime-routes';

// A resposta e o "digitando" do bot em tempo real (spec da F11, "Decisões de teste"; F11-T03,
// CA2; F11-T05, CA5).
describe('Resposta e digitando do bot em tempo real', () => {
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

  // O "digitando" do bot (spec da F11, ""Digitando" do bot"; F11-T05, CA5): vai às abas com a
  // Conversa do Pedido aberta, e a resposta gravada emite o fim.
  async function botRequestWithReader() {
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
    const opened = await openConversation(socket, channel.id);
    if (!opened.ok) throw new Error('A Pessoa não abriu a Conversa');
    const expected = {
      conversation_id: channel.id,
      author: {
        kind: 'bot',
        id: bot.id,
        name: 'Assistente',
        username: bot.username,
      },
    };
    return { author, channel, requestId, socket, expected };
  }

  it('o digitando do bot chega com author bot só a quem abriu a Conversa', async () => {
    const { author, requestId, socket, expected } =
      await botRequestWithReader();
    const closed = await realtimeRoutes.connected(url, { token: author.token });
    sockets.push(closed);
    const started = collectEvents(socket, 'typing.start');
    const notOpened = collectEvents(closed, 'typing.start');

    await botRoutes.typing(app, requestId).expect(204);

    expect(await waitForCount(started, 1)).toEqual([expected]);
    await settle();
    expect(notOpened).toHaveLength(0);
  });

  it('a resposta do bot emite o fim do digitando', async () => {
    const { requestId, socket, expected } = await botRequestWithReader();
    await botRoutes.typing(app, requestId).expect(204);
    const stopped = collectEvents(socket, 'typing.stop');

    await botRoutes.reply(app, requestId, 'Resumo de hoje').expect(201);

    expect(await waitForCount(stopped, 1)).toEqual([expected]);
  });

  it('o digitando depois da resposta não é emitido', async () => {
    const { requestId, socket } = await botRequestWithReader();
    await botRoutes.reply(app, requestId, 'Resumo de hoje').expect(201);
    const started = collectEvents(socket, 'typing.start');

    const response = await botRoutes.typing(app, requestId);

    expect(response.status).toBe(204);
    await settle();
    expect(started).toHaveLength(0);
  });
});
