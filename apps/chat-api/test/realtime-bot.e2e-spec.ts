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

    // Só os eventos do bot: o da Mensagem do Pedido sai depois do commit e, sob carga, pode
    // chegar a este socket já conectado.
    await waitForCount(received, 1);
    await settle();
    const fromBot = received.filter((e) => e.message.author.kind === 'bot');
    expect(fromBot).toHaveLength(1);
    const [event] = fromBot;
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
    return { author, requestId, socket, expected };
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

  // A pergunta e o encerramento dela (F11-T07, CA2 e CA4).
  it('a pergunta do bot chega com as Respostas prontas e encerra o digitando', async () => {
    const { author, requestId, socket, expected } =
      await botRequestWithReader();
    await botRoutes.typing(app, requestId).expect(204);
    const created = collectEvents(socket, 'message.created');
    const stopped = collectEvents(socket, 'typing.stop');

    await botRoutes.question(app, requestId).expect(201);

    const [event] = await waitForCount(created, 1);
    expect(event.message).toMatchObject({
      author: { kind: 'bot' },
      quick_replies: {
        options: ['Hoje (1)', 'Desde ontem (1)', 'A semana (1)', 'Tudo (1)'],
        owner_id: author.person.id,
        closed: false,
      },
    });
    expect(await waitForCount(stopped, 1)).toEqual([expected]);
  });

  it('encerrar a pergunta publica message.updated com closed', async () => {
    const author = await authRoutes.loggedIn(app);
    const reader = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const { questionId } = await botRoutes.openQuestion(
      app,
      author.cookie,
      channel.id,
      bot.username,
    );
    const listeners = await Promise.all(
      [author, reader].map(async ({ token }) => {
        const socket = await realtimeRoutes.connected(url, { token });
        sockets.push(socket);
        return collectEvents(socket, 'message.updated');
      }),
    );

    await conversationRoutes
      .sendMessage(app, author.cookie, channel.id, { body: 'Hoje (1)' })
      .expect(201);

    for (const updated of listeners) {
      const [event] = await waitForCount(updated, 1);
      expect(event.message).toMatchObject({
        id: questionId,
        edited_at: null,
        quick_replies: {
          options: ['Hoje (1)', 'Desde ontem (1)', 'A semana (1)', 'Tudo (1)'],
          owner_id: author.person.id,
          closed: true,
        },
      });
    }
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
