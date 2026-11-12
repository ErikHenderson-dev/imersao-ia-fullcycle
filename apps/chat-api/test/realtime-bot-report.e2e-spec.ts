import { INestApplication } from '@nestjs/common';
import type { MessagePayload } from 'chat-events';
import { PeopleService } from '../src/people/people.service';
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

// O Aviso de início e a falha do Relatório em tempo real e na reconexão (spec da F14, "Ações de bot
// do Relatório"; F14-T01, CA2 e CA3).
describe('Ações de bot do Relatório em tempo real', () => {
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

  // A Ana, com Permissão de dados, pede o Relatório num Canal com o Bruno, sem a permissão.
  async function scene() {
    const ana = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const bruno = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    await app.get(PeopleService).setDataAccess(ana.person.id, true);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const requestId = await botRoutes.openedRequestId(
      app,
      ana.cookie,
      channel.id,
      bot.username,
    );
    return { ana, bruno, channel, bot, requestId };
  }

  async function createdWithId(
    events: { message: MessagePayload }[],
    id: string,
  ): Promise<MessagePayload> {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const found = events.find((event) => event.message.id === id);
      if (found) return found.message;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`message.created da Mensagem ${id} não chegou`);
  }

  it('o Aviso de início emite o fim do digitando', async () => {
    const { ana, channel, bot, requestId } = await scene();
    const socket = await connected(ana.token);
    const opened = await openConversation(socket, channel.id);
    if (!opened.ok) throw new Error('A Pessoa não abriu a Conversa');
    await botRoutes.typing(app, requestId).expect(204);
    const stopped = collectEvents(socket, 'typing.stop');

    await botRoutes.reportStarted(app, requestId).expect(201);

    expect(await waitForCount(stopped, 1)).toEqual([
      {
        conversation_id: channel.id,
        author: {
          kind: 'bot',
          id: bot.id,
          name: 'Assistente',
          username: bot.username,
        },
      },
    ]);
  });

  it('a falha chega a cada Membro na sua versão e quem pediu recebe activity.unread', async () => {
    const { ana, bruno, requestId } = await scene();
    await botRoutes.reportStarted(app, requestId).expect(201);
    await settle();
    const anaSocket = await connected(ana.token);
    const brunoSocket = await connected(bruno.token);
    const toAna = collectEvents(anaSocket, 'message.created');
    const toBruno = collectEvents(brunoSocket, 'message.created');
    const anaActivity = collectEvents(anaSocket, 'activity.unread');
    const brunoActivity = collectEvents(brunoSocket, 'activity.unread');

    const response = await botRoutes.reportFailed(app, requestId).expect(201);

    const { id } = (response.body as { message: { id: string } }).message;
    expect(await createdWithId(toAna, id)).toMatchObject({
      body: `@${ana.person.username}, não consegui gerar o relatório.`,
      blocked: false,
      mentions: [{ id: ana.person.id, username: ana.person.username }],
    });
    expect(await createdWithId(toBruno, id)).toMatchObject({
      body: '',
      blocked: true,
    });
    const [unread] = await waitForCount(anaActivity, 1);
    expect(unread).toMatchObject({ mention_count: 1 });
    await settle();
    expect(brunoActivity).toHaveLength(0);
  });

  it('a reconexão reenvia a falha bloqueada', async () => {
    const { bruno, requestId } = await scene();
    await botRoutes.reportStarted(app, requestId).expect(201);
    await settle();
    const first = await connected(bruno.token);
    const seen = collectEvents(first, 'sync');
    await waitForCount(seen, 1);
    const cursor = seen[0].cursor ?? undefined;
    first.disconnect();
    const failed = (
      (await botRoutes.reportFailed(app, requestId).expect(201)).body as {
        message: { id: string };
      }
    ).message;

    await settle();
    const again = await connected(bruno.token, cursor);

    const replayed = collectEvents(again, 'message.created');
    expect(await createdWithId(replayed, failed.id)).toMatchObject({
      body: '',
      blocked: true,
    });
  });
});
