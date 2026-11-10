import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import type { ConversationUnreadEvent } from 'chat-events';
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

type Listed = {
  id: string;
  last_read_message_id: string | null;
  unread_count: number;
  mention_count: number;
};

// Os números de Não lidas e de Menções em tempo real (spec da F07, "Tempo real").
describe('Não lidas em tempo real', () => {
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

  function unreadOf(socket: TestSocket) {
    return collectEvents(socket, 'conversation.unread');
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

  // Um Canal privado com a autora e o leitor, e uma Pessoa de fora.
  async function channelWithReader() {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const reader = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const outsider = await authRoutes.loggedIn(app, { name: 'Carla Dias' });
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [reader.person.id])
      .expect(200);
    return { author, reader, outsider, channelId };
  }

  it('a Mensagem enviada entrega os números a cada Membro', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const toReader = unreadOf(await connected(reader.token));
    const toAuthor = unreadOf(await connected(author.token));

    const messageId = await send(
      author.cookie,
      channelId,
      `Oi @${reader.person.username}`,
    );

    const [forReader] = await waitForCount(toReader, 1);
    const [forAuthor] = await waitForCount(toAuthor, 1);
    expect(forReader).toEqual<ConversationUnreadEvent>({
      event_id: expect.stringMatching(/^[^:]+:\d+-\d+$/) as string,
      conversation_id: channelId,
      last_read_message_id: null,
      unread_count: 1,
      mention_count: 1,
    });
    expect(forAuthor).toMatchObject({
      conversation_id: channelId,
      last_read_message_id: messageId,
      unread_count: 0,
      mention_count: 0,
    });
  });

  it('quem não é Membro não recebe', async () => {
    const { author, outsider, channelId } = await channelWithReader();
    const toOutsider = unreadOf(await connected(outsider.token));

    await send(author.cookie, channelId, 'Só para os Membros');

    await settle();
    expect(toOutsider).toHaveLength(0);
  });

  it('a leitura entrega os números zerados só a quem leu', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const messageId = await send(author.cookie, channelId, 'Uma');
    // Os números do envio saem depois da resposta: só os da leitura contam aqui.
    await settle();
    const toAuthor = unreadOf(await connected(author.token));
    const toReader = unreadOf(await connected(reader.token));
    const toReaderOtherTab = unreadOf(await connected(reader.token));

    await read(reader.cookie, channelId, messageId);

    const [event] = await waitForCount(toReader, 1);
    await waitForCount(toReaderOtherTab, 1);
    expect(event).toMatchObject({
      conversation_id: channelId,
      last_read_message_id: messageId,
      unread_count: 0,
    });
    await settle();
    expect(toAuthor).toHaveLength(0);
  });

  it('a leitura que não avança não entrega nada', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const messageId = await send(author.cookie, channelId, 'Uma');
    await read(reader.cookie, channelId, messageId);
    await settle();
    const toReader = unreadOf(await connected(reader.token));

    await read(reader.cookie, channelId, messageId);

    await settle();
    expect(toReader).toHaveLength(0);
  });

  it('a edição que muda Menções entrega só a quem entrou ou saiu', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const third = await authRoutes.loggedIn(app, { name: 'Dora Reis' });
    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [third.person.id])
      .expect(200);
    const messageId = await send(author.cookie, channelId, 'Sem Menção');
    await settle();
    const toReader = unreadOf(await connected(reader.token));
    const toThird = unreadOf(await connected(third.token));

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
    expect(event).toMatchObject({ unread_count: 1, mention_count: 1 });
    await settle();
    expect(toThird).toHaveLength(0);
  });

  it('a edição que tira uma Menção entrega só a quem saiu', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const third = await authRoutes.loggedIn(app, { name: 'Dora Reis' });
    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [third.person.id])
      .expect(200);
    const messageId = await send(
      author.cookie,
      channelId,
      `Oi @${reader.person.username}`,
    );
    await settle();
    const toReader = unreadOf(await connected(reader.token));
    const toThird = unreadOf(await connected(third.token));

    await conversationRoutes
      .editMessage(app, author.cookie, channelId, messageId, 'Sem Menção')
      .expect(200);

    const [event] = await waitForCount(toReader, 1);
    expect(event).toMatchObject({ unread_count: 1, mention_count: 0 });
    await settle();
    expect(toThird).toHaveLength(0);
  });

  it('apagar entrega só a quem ainda não tinha lido', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const third = await authRoutes.loggedIn(app, { name: 'Dora Reis' });
    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [third.person.id])
      .expect(200);
    const messageId = await send(author.cookie, channelId, 'Vai sair');
    await read(third.cookie, channelId, messageId);
    await settle();
    const toReader = unreadOf(await connected(reader.token));
    const toThird = unreadOf(await connected(third.token));
    const toAuthor = unreadOf(await connected(author.token));

    await conversationRoutes
      .deleteMessage(app, author.cookie, channelId, messageId)
      .expect(204);

    const [event] = await waitForCount(toReader, 1);
    expect(event).toMatchObject({ unread_count: 0, mention_count: 0 });
    await settle();
    expect(toThird).toHaveLength(0);
    expect(toAuthor).toHaveLength(0);
  });

  it('o reenvio não entrega nada', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const clientId = randomUUID();
    await conversationRoutes
      .sendMessage(app, author.cookie, channelId, { clientId })
      .expect(201);
    await settle();
    const toReader = unreadOf(await connected(reader.token));

    await conversationRoutes
      .sendMessage(app, author.cookie, channelId, { clientId })
      .expect(201);

    await settle();
    expect(toReader).toHaveLength(0);
  });

  it('o evento volta na reconexão com cursor', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const first = await connected(reader.token);
    const [sync] = await waitForCount(collectEvents(first, 'sync'), 1);
    first.disconnect();
    await send(author.cookie, channelId, 'Durante a queda');
    await settle();

    const back = realtimeRoutes.socket(url, {
      token: reader.token,
      cursor: sync.cursor ?? undefined,
    });
    sockets.push(back);
    const replayed = unreadOf(back);
    back.connect();

    const [event] = await waitForCount(replayed, 1);
    expect(event).toMatchObject({
      conversation_id: channelId,
      unread_count: 1,
    });
  });

  it('várias Mensagens e uma leitura terminam com o último evento igual à lista', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const toReader = unreadOf(await connected(reader.token));

    const ids = await Promise.all(
      ['Um', 'Dois', 'Três'].map((body) =>
        send(author.cookie, channelId, body),
      ),
    );
    await read(reader.cookie, channelId, ids.sort()[1]);
    await send(author.cookie, channelId, `Quatro @${reader.person.username}`);

    await settle(800);
    const listed = await conversationRoutes.listed<Listed>(
      app,
      reader.cookie,
      channelId,
    );
    const last = toReader.at(-1)!;
    expect({
      last_read_message_id: last.last_read_message_id,
      unread_count: last.unread_count,
      mention_count: last.mention_count,
    }).toEqual({
      last_read_message_id: listed.last_read_message_id,
      unread_count: listed.unread_count,
      mention_count: listed.mention_count,
    });
  });
});
