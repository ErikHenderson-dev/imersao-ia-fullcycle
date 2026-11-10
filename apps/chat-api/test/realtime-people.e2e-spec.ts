import { INestApplication } from '@nestjs/common';
import type { PersonUpdatedEvent } from 'chat-events';
import request from 'supertest';
import { App } from 'supertest/types';
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

describe('Perfil em tempo real', () => {
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

  function editProfile(cookie: string, body: object) {
    return request(app.getHttpServer() as App)
      .patch('/v1/people/me')
      .set('Cookie', cookie)
      .send(body)
      .expect(200);
  }

  // A sala `workspace` leva os eventos de todos os testes que rodam juntos: cada um junta só os da
  // própria Pessoa.
  function updatesOf(socket: TestSocket, personId: string) {
    const received: PersonUpdatedEvent[] = [];
    socket.on('person.updated', (event) => {
      if (event.id === personId) received.push(event);
    });
    return received;
  }

  it('o person.updated chega a quem não divide Conversa', async () => {
    const editor = await authRoutes.loggedIn(app);
    const stranger = await authRoutes.loggedIn(app);
    const socket = await connected(stranger.token);
    const updates = updatesOf(socket, editor.person.id);

    await editProfile(editor.cookie, { name: 'Ana Lima' });

    await waitForCount(updates, 1);
    expect(updates).toEqual([
      {
        id: editor.person.id,
        name: 'Ana Lima',
        username: editor.person.username,
        title: null,
      },
    ]);
  });

  it('publica a mudança a todas as abas, inclusive às de quem editou', async () => {
    const editor = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const editorTab = await connected(editor.token);
    const otherTab = await connected(other.token);
    const inEditorTab = updatesOf(editorTab, editor.person.id);
    const inOtherTab = updatesOf(otherTab, editor.person.id);

    await editProfile(editor.cookie, { title: 'Produto' });

    await waitForCount(inEditorTab, 1);
    await waitForCount(inOtherTab, 1);
    expect(inOtherTab[0]).toMatchObject({ title: 'Produto' });
  });

  it('não publica sem mudança no que o workspace vê', async () => {
    const editor = await authRoutes.loggedIn(app);
    const socket = await connected(editor.token);
    const updates = updatesOf(socket, editor.person.id);

    await editProfile(editor.cookie, { name: editor.person.name });
    await editProfile(editor.cookie, { phone: '1234' });

    await settle();
    expect(updates).toEqual([]);
  });

  it('não volta na reconexão com cursor', async () => {
    const editor = await authRoutes.loggedIn(app);
    const first = await connected(editor.token);
    const syncs = collectEvents(first, 'sync');
    await waitForCount(syncs, 1);
    first.disconnect();

    await editProfile(editor.cookie, { name: 'Ana Lima' });
    const socket = realtimeRoutes.socket(url, {
      token: editor.token,
      cursor: syncs[0].cursor ?? undefined,
    });
    sockets.push(socket);
    const updates = updatesOf(socket, editor.person.id);
    const replaySync = collectEvents(socket, 'sync');
    socket.connect();
    await waitForCount(replaySync, 1);

    await settle();
    expect(updates).toEqual([]);
  });

  it('o digitando sai com o nome novo', async () => {
    const typist = await authRoutes.loggedIn(app);
    const reader = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const typistSocket = await connected(typist.token);
    const readerSocket = await connected(reader.token);
    await openConversation(typistSocket, channel.id);
    await openConversation(readerSocket, channel.id);
    const typing = collectEvents(readerSocket, 'typing.start');

    await editProfile(typist.cookie, { name: 'Ana Lima' });
    typistSocket.emit('typing.start', { conversation_id: channel.id });

    const [event] = await waitForCount(typing, 1);
    expect(event.person).toEqual({ id: typist.person.id, name: 'Ana Lima' });
  });
});
