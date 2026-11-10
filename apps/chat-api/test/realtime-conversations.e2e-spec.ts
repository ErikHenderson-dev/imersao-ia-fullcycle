import { INestApplication } from '@nestjs/common';
import type { ConversationMemberAddedEvent } from 'chat-events';
import { randomUUID } from 'node:crypto';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import {
  collectEvents,
  listenTestApp,
  openConversation,
  realtimeRoutes,
  settle,
  testRedis,
  TestSocket,
  waitForCount,
} from './support/realtime-routes';

type ConversationBody = ConversationMemberAddedEvent['conversation'];

const createChannel = (
  app: INestApplication,
  cookie: string,
  body: { kind?: string; clientId?: string } = {},
) => conversationRoutes.createChannelByRest(app, cookie, body);

// Os eventos de um Canal: outros testes criam Canais públicos ao mesmo tempo.
function eventsOf(
  events: ConversationMemberAddedEvent[],
  conversationId: string,
): ConversationMemberAddedEvent[] {
  return events.filter((event) => event.conversation.id === conversationId);
}

async function waitForConversation(
  events: ConversationMemberAddedEvent[],
  conversationId: string,
): Promise<ConversationMemberAddedEvent> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const [event] = eventsOf(events, conversationId);
    if (event) return event;
    if (Date.now() > deadline) throw new Error('O evento do Canal não chegou');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('Canais novos em tempo real', () => {
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

  async function listening(token: string) {
    const socket = await realtimeRoutes.connected(url, { token });
    sockets.push(socket);
    return collectEvents(socket, 'conversation.member_added');
  }

  it('o Canal público novo chega a todas as Pessoas conectadas', async () => {
    const creator = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const creatorEvents = await listening(creator.token);
    const otherEvents = await listening(other.token);

    const response = await createChannel(app, creator.cookie);

    const { conversation } = response.body as {
      conversation: ConversationBody;
    };
    const event = await waitForConversation(otherEvents, conversation.id);
    // Todas entraram agora: cada uma recebe person_ids só com ela mesma.
    expect(event).toEqual({
      event_id: expect.stringMatching(/^[^:]+:\d+-\d+$/) as string,
      conversation,
      person_ids: [other.person.id],
    });
    const creatorEvent = await waitForConversation(
      creatorEvents,
      conversation.id,
    );
    expect(creatorEvent.person_ids).toEqual([creator.person.id]);
  });

  it('o reenvio da criação não gera outro evento', async () => {
    const creator = await authRoutes.loggedIn(app);
    const events = await listening(creator.token);
    const clientId = randomUUID();
    const first = await createChannel(app, creator.cookie, { clientId });
    const { id } = (first.body as { conversation: ConversationBody })
      .conversation;
    await waitForConversation(events, id);

    await createChannel(app, creator.cookie, { clientId });

    await settle();
    expect(eventsOf(events, id)).toHaveLength(1);
  });

  it('o Canal privado novo chega só às abas de quem o criou', async () => {
    const creator = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const firstTab = await listening(creator.token);
    const secondTab = await listening(creator.token);
    const otherEvents = await listening(other.token);

    const response = await createChannel(app, creator.cookie, {
      kind: 'private_channel',
    });

    const { conversation } = response.body as {
      conversation: ConversationBody;
    };
    const event = await waitForConversation(firstTab, conversation.id);
    expect(event.person_ids).toEqual([creator.person.id]);
    await waitForConversation(secondTab, conversation.id);
    await settle();
    expect(eventsOf(otherEvents, conversation.id)).toHaveLength(0);
  });

  it('a abertura da Conversa direta chega às abas de quem abriu e não à outra Pessoa', async () => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const openerTab = await listening(opener.token);
    const otherEvents = await listening(other.token);

    const response = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );

    const { conversation } = response.body as {
      conversation: ConversationBody;
    };
    const event = await waitForConversation(openerTab, conversation.id);
    expect(event.person_ids).toEqual([opener.person.id]);
    expect(event.conversation.counterpart?.id).toBe(other.person.id);
    await settle();
    expect(eventsOf(otherEvents, conversation.id)).toHaveLength(0);
  });

  it('abrir de novo a Conversa direta não publica', async () => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    // Ouvindo desde antes da primeira abertura: o evento dela sai depois da resposta e, sem esperar
    // por ele, poderia chegar depois da segunda e contar como dela.
    const events = await listening(opener.token);
    const first = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );
    const { id } = (first.body as { conversation: ConversationBody })
      .conversation;
    // Outros testes criam Canais públicos ao mesmo tempo: espera o evento desta Conversa.
    const deadline = Date.now() + 2000;
    while (eventsOf(events, id).length === 0 && Date.now() < deadline) {
      await settle(10);
    }

    await conversationRoutes.openDirect(app, opener.cookie, other.person.id);

    await settle();
    expect(eventsOf(events, id)).toHaveLength(1);
  });

  const privateChannelOf = (cookie: string) =>
    conversationRoutes.privateChannelOf(app, cookie);

  it('a adição chega aos Membros antigos e novos', async () => {
    const owner = await authRoutes.loggedIn(app);
    const added = await authRoutes.loggedIn(app);
    const outsider = await authRoutes.loggedIn(app);
    const channelId = await privateChannelOf(owner.cookie);
    const ownerEvents = await listening(owner.token);
    const addedEvents = await listening(added.token);
    const outsiderEvents = await listening(outsider.token);

    await conversationRoutes
      .addMembers(app, owner.cookie, channelId, [added.person.id])
      .expect(200);

    const toOwner = await waitForConversation(ownerEvents, channelId);
    const toAdded = await waitForConversation(addedEvents, channelId);
    expect(toOwner.person_ids).toEqual([added.person.id]);
    expect(toOwner.conversation.member_count).toBe(2);
    expect(toAdded.person_ids).toEqual([added.person.id]);
    await settle();
    expect(eventsOf(outsiderEvents, channelId)).toHaveLength(0);
  });

  it('a adição sem Pessoa nova não gera evento', async () => {
    const owner = await authRoutes.loggedIn(app);
    const added = await authRoutes.loggedIn(app);
    const channelId = await privateChannelOf(owner.cookie);
    await conversationRoutes
      .addMembers(app, owner.cookie, channelId, [added.person.id])
      .expect(200);
    const events = await listening(owner.token);

    await conversationRoutes
      .addMembers(app, owner.cookie, channelId, [added.person.id])
      .expect(200);

    await settle();
    expect(eventsOf(events, channelId)).toHaveLength(0);
  });

  it('a Pessoa adicionada recebe as Mensagens e abre a Conversa', async () => {
    const owner = await authRoutes.loggedIn(app);
    const added = await authRoutes.loggedIn(app);
    const channelId = await privateChannelOf(owner.cookie);
    const socket = await realtimeRoutes.connected(url, { token: added.token });
    sockets.push(socket);
    const messages = collectEvents(socket, 'message.created');
    await conversationRoutes
      .addMembers(app, owner.cookie, channelId, [added.person.id])
      .expect(200);

    const opened = await openConversation(socket, channelId);
    await conversationRoutes
      .sendMessage(app, owner.cookie, channelId, { body: 'Bem-vinda' })
      .expect(201);

    expect(opened).toEqual({ ok: true });
    const [event] = await waitForCount(messages, 1);
    expect(event.message.body).toBe('Bem-vinda');
  });

  it('o evento volta na reconexão com cursor', async () => {
    const reader = await authRoutes.loggedIn(app);
    const creator = await authRoutes.loggedIn(app);
    // Um evento antes da conexão: sem stream, o cursor 0-0 conta como perdido (spec da F03).
    await createChannel(app, reader.cookie, { kind: 'private_channel' });
    const first = realtimeRoutes.socket(url, { token: reader.token });
    sockets.push(first);
    const syncs = collectEvents(first, 'sync');
    first.connect();
    const [{ cursor }] = await waitForCount(syncs, 1);
    first.disconnect();
    const response = await createChannel(app, creator.cookie);
    const { id } = (response.body as { conversation: ConversationBody })
      .conversation;

    const second = realtimeRoutes.socket(url, {
      token: reader.token,
      cursor: cursor!,
    });
    sockets.push(second);
    const replayed = collectEvents(second, 'conversation.member_added');
    const secondSyncs = collectEvents(second, 'sync');
    second.connect();

    const [sync] = await waitForCount(secondSyncs, 1);
    expect(sync.reset).toBe(false);
    // A publicação, fora da resposta, pode estar em andamento na reconexão: o mesmo evento chega
    // então pelo reenvio e ao vivo, com o mesmo cursor, que a aba descarta (spec da F03).
    const cursors = new Set(
      eventsOf(replayed, id).map((event) => event.event_id),
    );
    expect(cursors.size).toBe(1);
  });
});

describe('Conversa direta na primeira Mensagem', () => {
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

  // Os eventos da Conversa na ordem em que chegam, os dois tipos numa lista só.
  function inOrder(socket: TestSocket, conversationId: string) {
    const received: { name: string; person_ids?: string[] }[] = [];
    socket.on('conversation.member_added', (event) => {
      if (event.conversation.id === conversationId) {
        received.push({ name: 'member_added', person_ids: event.person_ids });
      }
    });
    socket.on('message.created', (event) => {
      if (event.message.conversation_id === conversationId) {
        received.push({ name: 'message.created' });
      }
    });
    return received;
  }

  async function openedBy() {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const response = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );
    const { id } = (response.body as { conversation: ConversationBody })
      .conversation;
    return { opener, other, id };
  }

  it('a primeira Mensagem da Conversa direta entrega o member_added e depois a Mensagem', async () => {
    const { opener, other, id } = await openedBy();
    const socket = await realtimeRoutes.connected(url, { token: other.token });
    sockets.push(socket);
    const received = inOrder(socket, id);

    await conversationRoutes.sendMessage(app, opener.cookie, id).expect(201);

    await waitForCount(received, 2);
    expect(received.map((event) => event.name)).toEqual([
      'member_added',
      'message.created',
    ]);
    expect(received[0].person_ids).toEqual([other.person.id]);
  });

  it('duas Mensagens ao mesmo tempo chegam depois do member_added', async () => {
    const { opener, other, id } = await openedBy();
    const socket = await realtimeRoutes.connected(url, { token: other.token });
    sockets.push(socket);
    const received = inOrder(socket, id);

    await Promise.all([
      conversationRoutes.sendMessage(app, opener.cookie, id).expect(201),
      conversationRoutes.sendMessage(app, opener.cookie, id).expect(201),
    ]);

    await waitForCount(received, 3);
    expect(received.map((event) => event.name)).toEqual([
      'member_added',
      'message.created',
      'message.created',
    ]);
  });

  it('a segunda Mensagem só entrega a Mensagem', async () => {
    const { opener, other, id } = await openedBy();
    await conversationRoutes.sendMessage(app, opener.cookie, id).expect(201);
    await settle();
    const socket = await realtimeRoutes.connected(url, { token: other.token });
    sockets.push(socket);
    const received = inOrder(socket, id);

    await conversationRoutes.sendMessage(app, opener.cookie, id).expect(201);

    await waitForCount(received, 1);
    await settle();
    expect(received.map((event) => event.name)).toEqual(['message.created']);
  });

  it('os dois voltam na reconexão na mesma ordem', async () => {
    const { opener, other, id } = await openedBy();
    // Um evento antes da conexão: sem stream, o cursor 0-0 conta como perdido (spec da F03).
    await conversationRoutes.privateChannelOf(app, other.cookie);
    const first = realtimeRoutes.socket(url, { token: other.token });
    sockets.push(first);
    const syncs = collectEvents(first, 'sync');
    first.connect();
    const [{ cursor }] = await waitForCount(syncs, 1);
    first.disconnect();
    await conversationRoutes.sendMessage(app, opener.cookie, id).expect(201);
    await settle();

    const second = realtimeRoutes.socket(url, {
      token: other.token,
      cursor: cursor ?? undefined,
    });
    sockets.push(second);
    const received = inOrder(second, id);
    second.connect();

    await waitForCount(received, 2);
    expect(received.map((event) => event.name)).toEqual([
      'member_added',
      'message.created',
    ]);
  });
});

describe('Canais novos com o Redis fora', () => {
  let app: INestApplication;
  let url: string;
  let socket: TestSocket;

  beforeAll(async () => {
    ({ app, url } = await listenTestApp());
    testRedis(app).destroy();
  });

  afterAll(async () => {
    socket?.disconnect();
    await app.close();
  });

  it('com o Redis fora, o evento sai sem event_id', async () => {
    const creator = await authRoutes.loggedIn(app);
    socket = await realtimeRoutes.connected(url, { token: creator.token });
    const events = collectEvents(socket, 'conversation.member_added');

    const response = await createChannel(app, creator.cookie, {
      kind: 'private_channel',
    });

    expect(response.status).toBe(201);
    const { id } = (response.body as { conversation: ConversationBody })
      .conversation;
    const event = await waitForConversation(events, id);
    expect(event.event_id).toBeUndefined();
  });
});
