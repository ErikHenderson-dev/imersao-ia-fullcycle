import { INestApplication } from '@nestjs/common';
import type { MessageCreatedEvent, MessageUpdatedEvent } from 'chat-events';
import { compareStreamIds } from '../src/realtime/events.store';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import {
  collectEvents,
  listenTestApp,
  realtimeRoutes,
  settle,
  testRedis,
  TestSocket,
  waitForCount,
} from './support/realtime-routes';

const CURSOR = /^[^:]+:\d+-\d+$/;

describe('Recuperação depois da queda', () => {
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

  // Conecta e junta o que chega até o sync, inclusive o próprio sync.
  async function connectAndSync(token: string, cursor?: string) {
    const socket = realtimeRoutes.socket(url, { token, cursor });
    sockets.push(socket);
    const messages = collectEvents(socket, 'message.created');
    // Os números de Não lidas saem depois de cada Mensagem (F07): também contam para o cursor.
    const unread = collectEvents(socket, 'conversation.unread');
    // Os cursores de todos os eventos guardados que chegaram até o sync, de qualquer tipo: outros
    // testes criam Canais públicos ao mesmo tempo, e o member_added deles também avança o cursor.
    const cursorsBeforeSync: string[] = [];
    const received: string[] = [];
    for (const name of [
      'message.created',
      'message.updated',
      'message.deleted',
      'conversation.member_added',
      'conversation.unread',
      'activity.unread',
    ] as const) {
      collectEvents(socket, name);
      socket.on(name, (event: { event_id?: string }) => {
        if (event.event_id) received.push(event.event_id);
      });
    }
    const syncs = collectEvents(socket, 'sync');
    socket.once('sync', () => cursorsBeforeSync.push(...received));
    socket.connect();
    const [sync] = await waitForCount(syncs, 1);
    return { socket, messages, unread, sync, cursorsBeforeSync };
  }

  // Duas Pessoas no mesmo Canal: a autora envia, a leitora recebe.
  async function channelWithReader() {
    const author = await authRoutes.loggedIn(app);
    const reader = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const send = (body: string) =>
      conversationRoutes
        .sendMessage(app, author.cookie, channel.id, { body })
        .expect(201);
    return { reader, send, channelId: channel.id };
  }

  it('o evento leva o cursor da Pessoa, crescente', async () => {
    const { reader, send, channelId } = await channelWithReader();
    const { messages } = await connectAndSync(reader.token);

    await send('Primeira');
    await send('Segunda');

    await waitForCount(messages, 2);
    const [first, second] = messages.filter(
      (event) => event.message.conversation_id === channelId,
    );
    expect(first.event_id).toMatch(CURSOR);
    expect(second.event_id).toMatch(CURSOR);
    const id = (event: MessageCreatedEvent) =>
      event.event_id!.split(':')[1].split('-').map(Number);
    const [firstMs, firstSeq] = id(first);
    const [secondMs, secondSeq] = id(second);
    expect(
      secondMs > firstMs || (secondMs === firstMs && secondSeq > firstSeq),
    ).toBe(true);
  });

  it('reenvia em ordem os eventos depois do cursor', async () => {
    const { reader, send, channelId } = await channelWithReader();
    const first = await connectAndSync(reader.token);
    await send('Antes da queda');
    const [seen] = await waitForCount(first.messages, 1);
    first.socket.disconnect();
    await send('Durante a queda 1');
    await send('Durante a queda 2');

    const { messages, sync, cursorsBeforeSync } = await connectAndSync(
      reader.token,
      seen.event_id,
    );

    // Outros testes criam Canais públicos ao mesmo tempo, que incluem esta Pessoa: só os eventos
    // deste Canal contam. A publicação sai depois da resposta do envio, e um evento pode chegar
    // ao vivo e no reenvio, em qualquer ordem: como a aba, o teste fica com um por cursor, em
    // ordem de cursor.
    const ours = [
      ...new Map(
        messages
          .filter((event) => event.message.conversation_id === channelId)
          .map((event) => [event.event_id, event]),
      ).values(),
    ].sort((a, b) =>
      compareStreamIds(a.event_id!.split(':')[1], b.event_id!.split(':')[1]),
    );
    expect(ours.map((event) => event.message.body)).toEqual([
      'Durante a queda 1',
      'Durante a queda 2',
    ]);
    // O cursor do sync é o do último evento reenviado, de qualquer tipo, como os números de Não
    // lidas que saem depois de cada Mensagem (F07).
    const lastCursor = [...cursorsBeforeSync]
      .sort((a, b) => compareStreamIds(a.split(':')[1], b.split(':')[1]))
      .at(-1);
    expect(sync).toEqual({ cursor: lastCursor, reset: false });
  });

  it('a edição e a exclusão feitas durante a queda voltam na reconexão, nessa ordem', async () => {
    const author = await authRoutes.loggedIn(app);
    const reader = await authRoutes.loggedIn(app);
    // Um Canal privado só dos dois: os Canais públicos de outras suítes, ao mesmo tempo, incluem
    // esta Pessoa e trariam eventos deles.
    const channel = {
      id: await conversationRoutes.privateChannelOf(app, author.cookie),
    };
    await conversationRoutes
      .addMembers(app, author.cookie, channel.id, [reader.person.id])
      .expect(200);
    const first = await connectAndSync(reader.token);
    const sent = await conversationRoutes
      .sendMessage(app, author.cookie, channel.id, { body: 'Antes' })
      .expect(201);
    const messageId = (sent.body as { message: { id: string } }).message.id;
    const [seen] = await waitForCount(first.messages, 1);
    first.socket.disconnect();
    await conversationRoutes
      .editMessage(app, author.cookie, channel.id, messageId, 'Editada')
      .expect(200);
    await conversationRoutes
      .deleteMessage(app, author.cookie, channel.id, messageId)
      .expect(204);
    await settle(200);
    const socket = realtimeRoutes.socket(url, {
      token: reader.token,
      cursor: seen.event_id,
    });
    sockets.push(socket);
    // A publicação pode cruzar com a reconexão e chegar pelo reenvio e ao vivo, com o mesmo cursor:
    // conta cada cursor uma vez, como a aba (orderForSync).
    const received: { name: string; eventId?: string }[] = [];
    // Só os desta Mensagem: um Canal público criado por outra suíte inclui a Pessoa e traz os dele.
    socket.on('message.updated', (event) => {
      if (event.message.id === messageId) {
        received.push({ name: 'message.updated', eventId: event.event_id });
      }
    });
    socket.on('message.deleted', (event) => {
      if (event.message_id === messageId) {
        received.push({ name: 'message.deleted', eventId: event.event_id });
      }
    });
    const syncs = collectEvents(socket, 'sync');

    socket.connect();

    const [sync] = await waitForCount(syncs, 1);
    expect(sync.reset).toBe(false);
    // A publicação ainda em andamento na reconexão chega ao vivo, logo depois do sync.
    await waitForCount(received, 2, 5000);
    // Como a aba até o sync (orderForSync): um evento ao vivo pode chegar no meio do reenvio, então
    // a ordem é a do cursor, e o mesmo cursor conta uma vez.
    const byCursor = new Map(
      received.map((event) => [event.eventId!, event.name] as const),
    );
    const names = [...byCursor.entries()]
      .sort(([a], [b]) => compareStreamIds(a.split(':')[1], b.split(':')[1]))
      .map(([, name]) => name);
    expect(names).toEqual(['message.updated', 'message.deleted']);
  });

  it('a edição feita durante a queda volta na reconexão', async () => {
    const author = await authRoutes.loggedIn(app);
    const reader = await authRoutes.loggedIn(app);
    // Um Canal privado só dos dois: os Canais públicos de outras suítes, ao mesmo tempo, incluem
    // esta Pessoa e trariam eventos deles.
    const channel = {
      id: await conversationRoutes.privateChannelOf(app, author.cookie),
    };
    await conversationRoutes
      .addMembers(app, author.cookie, channel.id, [reader.person.id])
      .expect(200);
    const first = await connectAndSync(reader.token);
    const sent = await conversationRoutes
      .sendMessage(app, author.cookie, channel.id, { body: 'Antes' })
      .expect(201);
    const messageId = (sent.body as { message: { id: string } }).message.id;
    const [seen] = await waitForCount(first.messages, 1);
    first.socket.disconnect();
    await conversationRoutes
      .editMessage(
        app,
        author.cookie,
        channel.id,
        messageId,
        'Editada na queda',
      )
      .expect(200);
    const socket = realtimeRoutes.socket(url, {
      token: reader.token,
      cursor: seen.event_id,
    });
    sockets.push(socket);
    // Só os desta Mensagem: um Canal público criado por outra suíte inclui a Pessoa e traz os dele.
    const ours: MessageUpdatedEvent[] = [];
    socket.on('message.updated', (event) => {
      if (event.message.id === messageId) ours.push(event);
    });
    const syncs = collectEvents(socket, 'sync');

    socket.connect();

    const [sync] = await waitForCount(syncs, 1);
    expect(sync.reset).toBe(false);
    // A publicação sai depois da resposta e pode cruzar com a reconexão: o mesmo evento chega pelo
    // reenvio e ao vivo, com o mesmo cursor, e a aba descarta o repetido (orderForSync); ainda em
    // andamento, chega ao vivo logo depois do sync.
    await waitForCount(ours, 1, 5000);
    expect(new Set(ours.map((event) => event.event_id)).size).toBe(1);
    expect(ours[0].message).toMatchObject({
      id: messageId,
      body: 'Editada na queda',
    });
  });

  it('sem cursor, sync com reset', async () => {
    const { token } = await authRoutes.loggedIn(app);

    const { sync } = await connectAndSync(token);

    expect(sync.reset).toBe(true);
    expect(sync.cursor).toMatch(CURSOR);
  });

  it('cursor de outra época, sync com reset', async () => {
    const { reader, send } = await channelWithReader();
    const first = await connectAndSync(reader.token);
    await send('Antes da troca de época');
    const [seen] = await waitForCount(first.messages, 1);
    first.socket.disconnect();
    await testRedis(app).del('events:epoch');

    const { messages, sync } = await connectAndSync(
      reader.token,
      seen.event_id,
    );

    expect(sync.reset).toBe(true);
    expect(messages).toHaveLength(0);
  });

  it('cursor anterior ao corte, sync com reset', async () => {
    const { reader, send } = await channelWithReader();
    const redis = testRedis(app);
    const key = `events:person:${reader.person.id}`;
    const old = Date.now() - 10 * 60_000;
    // Numa transação: eventos de Canais que outros testes criam ao mesmo tempo podem chegar a esta
    // Pessoa, e o XADD com id antigo exige o stream vazio.
    await redis
      .multi()
      .del(key)
      .addCommand(['XADD', key, `${old}-0`, 'event', '{}'])
      .addCommand(['XADD', key, `${old + 1}-0`, 'event', '{}'])
      .exec();
    const epoch = await redis.get('events:epoch');
    await send('Depois dos antigos');
    // O corte aproximado (MINID ~) só apaga nós inteiros do stream: num stream pequeno, o teste
    // faz o corte exato, como o Redis faria num maior.
    await redis.sendCommand(['XTRIM', key, 'MINID', `${old + 2}-0`]);

    const { sync } = await connectAndSync(reader.token, `${epoch}:${old}-0`);

    expect(sync.reset).toBe(true);
  });
});

describe('Recuperação com o Redis fora', () => {
  let app: INestApplication;
  let url: string;
  const sockets: TestSocket[] = [];

  beforeAll(async () => {
    // Uma aplicação só para este caso, com o cliente do Redis fechado: os comandos falham na
    // hora, como com o Redis fora.
    ({ app, url } = await listenTestApp());
    testRedis(app).destroy();
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  it('com o Redis fora, o envio responde 201, o evento sai sem cursor e a conexão recebe reset', async () => {
    const author = await authRoutes.loggedIn(app);
    const reader = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const socket = realtimeRoutes.socket(url, { token: reader.token });
    sockets.push(socket);
    const syncs = collectEvents(socket, 'sync');
    const messages = collectEvents(socket, 'message.created');
    socket.connect();
    const [sync] = await waitForCount(syncs, 1);

    const response = await conversationRoutes.sendMessage(
      app,
      author.cookie,
      channel.id,
      { body: 'Sem Redis' },
    );

    expect(response.status).toBe(201);
    expect(sync).toEqual({ cursor: null, reset: true });
    await waitForCount(messages, 1);
    const ours = messages.find(
      (event) => event.message.conversation_id === channel.id,
    );
    expect(ours?.event_id).toBeUndefined();
  });
});
