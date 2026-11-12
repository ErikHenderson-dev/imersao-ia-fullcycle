import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { ActivityUnreadEvent } from 'chat-events';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import {
  collectEvents,
  listenTestApp,
  realtimeRoutes,
  settle,
  type TestSocket,
  waitForCount,
} from './support/realtime-routes';

// Os números de Atividade em tempo real (spec da F08, "Tempo real").
describe('Atividade em tempo real', () => {
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

  function activityOf(socket: TestSocket) {
    return collectEvents(socket, 'activity.unread');
  }

  function send(cookie: string, conversationId: string, body: string) {
    return conversationRoutes.sentId(app, cookie, conversationId, body);
  }

  function read(cookie: string, conversationId: string, messageId: string) {
    return request(app.getHttpServer() as App)
      .put(`/v1/conversations/${conversationId}/read`)
      .set('Cookie', cookie)
      .send({ message_id: messageId })
      .expect(200);
  }

  // Um Canal privado com a autora, o leitor e uma terceira Pessoa, e a Conversa direta da autora
  // com o leitor.
  async function scene() {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const reader = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const third = await authRoutes.loggedIn(app, { name: 'Carla Dias' });
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [
        reader.person.id,
        third.person.id,
      ])
      .expect(200);
    const directId = await conversationRoutes.directOf(
      app,
      author.cookie,
      reader.person.id,
    );
    return { author, reader, third, channelId, directId };
  }

  it('a Menção num Canal entrega à Pessoa mencionada e ao autor', async () => {
    const { author, reader, third, channelId } = await scene();
    const toReader = activityOf(await connected(reader.token));
    const toAuthor = activityOf(await connected(author.token));
    const toThird = activityOf(await connected(third.token));

    await send(author.cookie, channelId, `Oi @${reader.person.username}`);

    const [event] = await waitForCount(toReader, 1);
    expect(event).toEqual<ActivityUnreadEvent>({
      event_id: expect.stringMatching(/^[^:]+:\d+-\d+$/) as string,
      activity_read_message_id: null,
      total_count: 1,
      mention_count: 1,
      direct_count: 0,
      task_count: 0,
    });
    await waitForCount(toAuthor, 1);
    await settle();
    expect(toThird).toHaveLength(0);
  });

  it('a Mensagem direta entrega à outra Pessoa e ao autor', async () => {
    const { author, reader, third, directId } = await scene();
    const toReader = activityOf(await connected(reader.token));
    const toAuthor = activityOf(await connected(author.token));
    const toThird = activityOf(await connected(third.token));

    await send(author.cookie, directId, 'Tudo bem?');

    const [event] = await waitForCount(toReader, 1);
    expect(event).toMatchObject({ total_count: 1, direct_count: 1 });
    await waitForCount(toAuthor, 1);
    await settle();
    expect(toThird).toHaveLength(0);
  });

  it('a edição que muda Menção entrega só a quem entrou ou saiu', async () => {
    const { author, reader, third, channelId } = await scene();
    const messageId = await send(author.cookie, channelId, 'Sem Menção');
    await settle();
    const toReader = activityOf(await connected(reader.token));
    const toThird = activityOf(await connected(third.token));

    await conversationRoutes
      .editMessage(
        app,
        author.cookie,
        channelId,
        messageId,
        `Agora @${reader.person.username}`,
      )
      .expect(200);

    const [event] = await waitForCount(toReader, 1);
    expect(event).toMatchObject({ mention_count: 1 });
    await settle();
    expect(toThird).toHaveLength(0);
  });

  it('a exclusão entrega só a quem não tinha lido', async () => {
    const { author, reader, third, channelId } = await scene();
    const messageId = await send(
      author.cookie,
      channelId,
      `@${reader.person.username} e @${third.person.username}`,
    );
    await read(third.cookie, channelId, messageId);
    await settle();
    const toReader = activityOf(await connected(reader.token));
    const toThird = activityOf(await connected(third.token));

    await conversationRoutes
      .deleteMessage(app, author.cookie, channelId, messageId)
      .expect(204);

    const [event] = await waitForCount(toReader, 1);
    expect(event).toMatchObject({ total_count: 0, mention_count: 0 });
    await settle();
    expect(toThird).toHaveLength(0);
  });

  it('a leitura entrega a todas as abas de quem leu', async () => {
    const { author, reader, channelId } = await scene();
    const messageId = await send(
      author.cookie,
      channelId,
      `@${reader.person.username}`,
    );
    await settle();
    const toReader = activityOf(await connected(reader.token));
    const toReaderOtherTab = activityOf(await connected(reader.token));
    const toAuthor = activityOf(await connected(author.token));

    await read(reader.cookie, channelId, messageId);

    const [event] = await waitForCount(toReader, 1);
    await waitForCount(toReaderOtherTab, 1);
    expect(event).toMatchObject({ total_count: 0 });
    await settle();
    expect(toAuthor).toHaveLength(0);
  });

  it('a leitura que não avança não entrega nada', async () => {
    const { author, reader, channelId } = await scene();
    const messageId = await send(author.cookie, channelId, 'Uma');
    await read(reader.cookie, channelId, messageId);
    await settle();
    const toReader = activityOf(await connected(reader.token));

    await read(reader.cookie, channelId, messageId);

    await settle();
    expect(toReader).toHaveLength(0);
  });

  it('o evento volta na reconexão com cursor', async () => {
    const { author, reader, channelId } = await scene();
    await send(author.cookie, channelId, 'Antes');
    await settle();
    const first = await connected(reader.token);
    const seen = collectEvents(first, 'sync');
    await waitForCount(seen, 1);
    const cursor = seen[0].cursor ?? undefined;
    first.disconnect();

    await send(author.cookie, channelId, `@${reader.person.username}`);

    await settle();
    const replay = activityOf(await connected(reader.token, cursor));
    const [event] = await waitForCount(replay, 1);
    expect(event).toMatchObject({ mention_count: 1 });
  });

  it('mudanças em sequência terminam com os números da rota', async () => {
    const { author, reader, channelId, directId } = await scene();
    const toReader = activityOf(await connected(reader.token));

    const sent = await Promise.all([
      send(author.cookie, channelId, `@${reader.person.username} 1`),
      send(author.cookie, directId, 'Direta 1'),
      send(author.cookie, channelId, `@${reader.person.username} 2`),
      send(author.cookie, directId, 'Direta 2'),
    ]);
    await read(reader.cookie, directId, sent[3]);

    await settle(600);
    const response = await request(app.getHttpServer() as App)
      .get('/v1/activity/unread')
      .set('Cookie', reader.cookie)
      .expect(200);
    expect(toReader.at(-1)).toMatchObject(
      response.body as Record<string, number>,
    );
  });

  function markRead(cookie: string, messageId: string) {
    return request(app.getHttpServer() as App)
      .put('/v1/activity/read')
      .set('Cookie', cookie)
      .send({ message_id: messageId })
      .expect(200);
  }

  it('a marca que avança entrega a todas as abas', async () => {
    const { author, reader, directId } = await scene();
    const messageId = await send(author.cookie, directId, 'Oi');
    await settle();
    const toReader = activityOf(await connected(reader.token));
    const toReaderOtherTab = activityOf(await connected(reader.token));

    await markRead(reader.cookie, messageId);

    const [event] = await waitForCount(toReader, 1);
    await waitForCount(toReaderOtherTab, 1);
    expect(event).toMatchObject({
      activity_read_message_id: messageId,
      total_count: 0,
    });
  });

  it('a marca que não avança não entrega nada', async () => {
    const { author, reader, directId } = await scene();
    const messageId = await send(author.cookie, directId, 'Oi');
    await markRead(reader.cookie, messageId);
    await settle();
    const toReader = activityOf(await connected(reader.token));

    await markRead(reader.cookie, messageId);

    await settle();
    expect(toReader).toHaveLength(0);
  });
});
