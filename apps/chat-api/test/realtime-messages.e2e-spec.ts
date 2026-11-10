import { INestApplication } from '@nestjs/common';
import type { MessageCreatedEvent, MessageUpdatedEvent } from 'chat-events';
import { randomUUID } from 'node:crypto';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import {
  collectEvents,
  listenTestApp,
  realtimeRoutes,
  settle,
  TestSocket,
  waitForCount,
} from './support/realtime-routes';

describe('Mensagens em tempo real', () => {
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

  async function connected(token: string): Promise<TestSocket> {
    const socket = await realtimeRoutes.connected(url, { token });
    sockets.push(socket);
    return socket;
  }

  function send(cookie: string, conversationId: string, clientId?: string) {
    return conversationRoutes.sendMessage(app, cookie, conversationId, {
      clientId,
    });
  }

  it('emite message.created para os Membros depois de gravar', async () => {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const reader = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const channel = await conversationRoutes.createChannel(app);
    const received = collectEvents(
      await connected(reader.token),
      'message.created',
    );

    const response = await send(author.cookie, channel.id);

    const [event] = await waitForCount(received, 1);
    expect(response.status).toBe(201);
    expect(event).toEqual<MessageCreatedEvent>({
      event_id: expect.stringMatching(/^[^:]+:\d+-\d+$/) as string,
      message: (response.body as { message: MessageCreatedEvent['message'] })
        .message,
    });
  });

  it('o evento chega à outra aba do autor', async () => {
    const author = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const received = collectEvents(
      await connected(author.token),
      'message.created',
    );

    const response = await send(author.cookie, channel.id);

    const [event] = await waitForCount(received, 1);
    expect(event.message.id).toBe(
      (response.body as { message: { id: string } }).message.id,
    );
  });

  it('quem não é Membro não recebe o evento', async () => {
    const author = await authRoutes.loggedIn(app);
    const outsider = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    await conversationRoutes.removeMembership(
      app,
      channel.id,
      outsider.person.id,
    );
    const received = collectEvents(
      await connected(outsider.token),
      'message.created',
    );

    await send(author.cookie, channel.id);

    await settle();
    expect(received).toHaveLength(0);
  });

  it('o reenvio do mesmo client_id não emite outro evento', async () => {
    const author = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const clientId = randomUUID();
    const received = collectEvents(
      await connected(author.token),
      'message.created',
    );
    await send(author.cookie, channel.id, clientId).expect(201);
    await waitForCount(received, 1);

    await send(author.cookie, channel.id, clientId).expect(201);

    await settle();
    expect(received).toHaveLength(1);
  });

  function editMessage(
    cookie: string,
    conversationId: string,
    messageId: string,
    body: string,
  ) {
    return conversationRoutes.editMessage(
      app,
      cookie,
      conversationId,
      messageId,
      body,
    );
  }

  async function sentId(cookie: string, conversationId: string) {
    const response = await send(cookie, conversationId).expect(201);
    return (response.body as { message: { id: string } }).message.id;
  }

  it('a edição emite message.updated para os Membros e as abas do autor', async () => {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const reader = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const outsider = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    await conversationRoutes.removeMembership(
      app,
      channel.id,
      outsider.person.id,
    );
    const messageId = await sentId(author.cookie, channel.id);
    const forReader = collectEvents(
      await connected(reader.token),
      'message.updated',
    );
    const forAuthor = collectEvents(
      await connected(author.token),
      'message.updated',
    );
    const forOutsider = collectEvents(
      await connected(outsider.token),
      'message.updated',
    );

    const response = await editMessage(
      author.cookie,
      channel.id,
      messageId,
      'Texto novo',
    );

    const [event] = await waitForCount(forReader, 1);
    await waitForCount(forAuthor, 1);
    await settle();
    expect(response.status).toBe(200);
    expect(event).toEqual<MessageUpdatedEvent>({
      event_id: expect.stringMatching(/^[^:]+:\d+-\d+$/) as string,
      message: (response.body as { message: MessageUpdatedEvent['message'] })
        .message,
    });
    expect(forOutsider).toHaveLength(0);
  });

  it('editar com o mesmo texto não emite nada', async () => {
    const author = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const messageId = await sentId(author.cookie, channel.id);
    const received = collectEvents(
      await connected(author.token),
      'message.updated',
    );

    await editMessage(
      author.cookie,
      channel.id,
      messageId,
      'Chegou na hora',
    ).expect(200);

    await settle();
    expect(received).toHaveLength(0);
  });

  it('emite sync com reset na conexão', async () => {
    const { token } = await authRoutes.loggedIn(app);
    const socket = realtimeRoutes.socket(url, { token });
    sockets.push(socket);
    const received = collectEvents(socket, 'sync');

    socket.connect();

    const [event] = await waitForCount(received, 1);
    expect(event).toEqual({
      cursor: expect.stringMatching(/^[^:]+:\d+-\d+$/) as string,
      reset: true,
    });
  });
});
