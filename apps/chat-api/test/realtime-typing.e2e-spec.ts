import { INestApplication } from '@nestjs/common';
import { authRoutes } from './support/auth-routes';
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

describe('"digitando" em tempo real', () => {
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

  // O Canal criado depois das Pessoas: criar um Canal público inclui todas as que já existem.
  type Member = Awaited<ReturnType<typeof authRoutes.loggedIn>>;

  async function withOpenConversation(member: Member, conversationId: string) {
    const socket = await connected(member.token);
    const result = await openConversation(socket, conversationId);
    if (!result.ok) throw new Error('A Pessoa não abriu a Conversa');
    return { ...member, socket };
  }

  function members(count: number): Promise<Member[]> {
    return Promise.all(
      Array.from({ length: count }, () => authRoutes.loggedIn(app)),
    );
  }

  it('abre a Conversa de que a Pessoa é Membro', async () => {
    const { token } = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const socket = await connected(token);

    const result = await openConversation(socket, channel.id);

    expect(result).toEqual({ ok: true });
  });

  it('recusa a Conversa de quem não é Membro', async () => {
    const [outsider, member] = await members(2);
    const channel = await conversationRoutes.createChannel(app);
    await conversationRoutes.removeMembership(
      app,
      channel.id,
      outsider.person.id,
    );
    const typist = await withOpenConversation(member, channel.id);
    const socket = await connected(outsider.token);
    const received = collectEvents(socket, 'typing.start');

    const result = await openConversation(socket, channel.id);

    typist.socket.emit('typing.start', { conversation_id: channel.id });
    await settle();
    expect(result).toEqual({ ok: false, code: 'conversation_not_found' });
    expect(received).toHaveLength(0);
  });

  it('a outra Pessoa não recebe o digitando antes da primeira Mensagem', async () => {
    const [opener, other] = await members(2);
    const response = await conversationRoutes.openDirect(
      app,
      opener.cookie,
      other.person.id,
    );
    const { id } = (response.body as { conversation: { id: string } })
      .conversation;
    const typist = await withOpenConversation(opener, id);
    const socket = await connected(other.token);
    const received = collectEvents(socket, 'typing.start');

    const result = await openConversation(socket, id);

    typist.socket.emit('typing.start', { conversation_id: id });
    await settle();
    expect(result).toEqual({ ok: false, code: 'conversation_not_found' });
    expect(received).toHaveLength(0);
  });

  it('abrir outra Conversa sai da anterior', async () => {
    const [typistMember, readerMember] = await members(2);
    const first = await conversationRoutes.createChannel(app);
    const second = await conversationRoutes.createChannel(app);
    const typist = await withOpenConversation(typistMember, first.id);
    const reader = await withOpenConversation(readerMember, first.id);
    const received = collectEvents(reader.socket, 'typing.start');

    await openConversation(reader.socket, second.id);

    typist.socket.emit('typing.start', { conversation_id: first.id });
    await settle();
    expect(received).toHaveLength(0);
  });

  it('fechar a Conversa deixa de receber o digitando', async () => {
    const [typistMember, readerMember] = await members(2);
    const channel = await conversationRoutes.createChannel(app);
    const typist = await withOpenConversation(typistMember, channel.id);
    const reader = await withOpenConversation(readerMember, channel.id);
    const received = collectEvents(reader.socket, 'typing.start');

    reader.socket.emit('conversation.close', { conversation_id: channel.id });

    await settle(100);
    typist.socket.emit('typing.start', { conversation_id: channel.id });
    await settle();
    expect(received).toHaveLength(0);
  });

  it('repassa o digitando aos outros da sala, sem as abas da própria Pessoa', async () => {
    const [typistMember, readerMember] = await members(2);
    const channel = await conversationRoutes.createChannel(app);
    const typist = await withOpenConversation(typistMember, channel.id);
    const sameTab = (await withOpenConversation(typistMember, channel.id))
      .socket;
    const reader = await withOpenConversation(readerMember, channel.id);
    const started = collectEvents(reader.socket, 'typing.start');
    const stopped = collectEvents(reader.socket, 'typing.stop');
    const own = collectEvents(sameTab, 'typing.start');

    typist.socket.emit('typing.start', { conversation_id: channel.id });
    typist.socket.emit('typing.stop', { conversation_id: channel.id });

    const expected = {
      conversation_id: channel.id,
      person: { id: typist.person.id, name: typist.person.name },
    };
    expect(await waitForCount(started, 1)).toEqual([expected]);
    expect(await waitForCount(stopped, 1)).toEqual([expected]);
    await settle();
    expect(own).toHaveLength(0);
  });

  it('ignora o digitando de quem não abriu a Conversa', async () => {
    const [typist, readerMember] = await members(2);
    const channel = await conversationRoutes.createChannel(app);
    const typistSocket = await connected(typist.token);
    const reader = await withOpenConversation(readerMember, channel.id);
    const received = collectEvents(reader.socket, 'typing.start');

    typistSocket.emit('typing.start', { conversation_id: channel.id });

    await settle();
    expect(received).toHaveLength(0);
  });

  it('sair da Conversa avisa que parou de digitar', async () => {
    const [typistMember, readerMember] = await members(2);
    const channel = await conversationRoutes.createChannel(app);
    const typist = await withOpenConversation(typistMember, channel.id);
    const reader = await withOpenConversation(readerMember, channel.id);
    const stopped = collectEvents(reader.socket, 'typing.stop');
    typist.socket.emit('typing.start', { conversation_id: channel.id });

    typist.socket.emit('conversation.close', { conversation_id: channel.id });

    expect(await waitForCount(stopped, 1)).toEqual([
      {
        conversation_id: channel.id,
        person: { id: typist.person.id, name: typist.person.name },
      },
    ]);
  });
});
