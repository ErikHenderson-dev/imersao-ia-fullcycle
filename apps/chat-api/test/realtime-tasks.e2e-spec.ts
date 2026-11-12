import { INestApplication } from '@nestjs/common';
import { authRoutes } from './support/auth-routes';
import {
  collectEvents,
  listenTestApp,
  realtimeRoutes,
  settle,
  TestSocket,
  waitForCount,
} from './support/realtime-routes';
import { taskRoutes } from './support/task-routes';

// Os eventos de Tarefa em tempo real (spec da F12, "Eventos"; F12-T02, CA3).
describe('Tarefas em tempo real', () => {
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

  async function scene() {
    const ana = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const bruno = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const { channel, bot } = await taskRoutes.channelWithBot(app);
    const delegate = () =>
      taskRoutes.delegated(app, {
        delegatorCookie: ana.cookie,
        conversationId: channel.id,
        botUsername: bot.username,
        assigneeUsername: bruno.person.username,
      });
    return { ana, bruno, delegate };
  }

  it('task.created e task.updated chegam ao Responsável e a quem delegou', async () => {
    const { ana, bruno, delegate } = await scene();
    const toAna = await connected(ana.token);
    const toBruno = await connected(bruno.token);
    const created = [toAna, toBruno].map((s) =>
      collectEvents(s, 'task.created'),
    );
    const updated = [toAna, toBruno].map((s) =>
      collectEvents(s, 'task.updated'),
    );
    const task = await delegate();
    await taskRoutes.change(app, bruno.cookie, task.id, 'complete').expect(200);

    await taskRoutes.change(app, bruno.cookie, task.id, 'complete').expect(200);

    for (const events of created) {
      const [event] = await waitForCount(events, 1);
      expect(event.task).toEqual(task);
    }
    for (const events of updated) {
      const [event] = await waitForCount(events, 1);
      expect(event.task).toMatchObject({ id: task.id, status: 'done' });
    }
    await settle();
    expect(updated.map((events) => events.length)).toEqual([1, 1]);
  });

  it('os eventos de Tarefa voltam na reconexão', async () => {
    const { bruno, delegate } = await scene();
    // Um evento antes da queda, para a conexão ter cursor.
    await delegate();
    await settle();
    const first = await connected(bruno.token);
    const seen = collectEvents(first, 'sync');
    await waitForCount(seen, 1);
    const cursor = seen[0].cursor ?? undefined;
    first.disconnect();
    const task = await delegate();

    await taskRoutes.change(app, bruno.cookie, task.id, 'complete').expect(200);

    await settle();
    const again = await connected(bruno.token, cursor);
    const created = collectEvents(again, 'task.created');
    const updated = collectEvents(again, 'task.updated');
    expect((await waitForCount(created, 1))[0].task.id).toBe(task.id);
    expect((await waitForCount(updated, 1))[0].task.status).toBe('done');
  });

  // A Notificação de Tarefa no evento (F12-T03, CA4).
  it('a Notificação vai só a quem recebe', async () => {
    const { ana, bruno, delegate } = await scene();
    const toAna = await connected(ana.token);
    const toBruno = await connected(bruno.token);
    const created = [toAna, toBruno].map((s) =>
      collectEvents(s, 'task.created'),
    );
    const updated = [toAna, toBruno].map((s) =>
      collectEvents(s, 'task.updated'),
    );
    const unread = collectEvents(toBruno, 'activity.unread');
    const task = await delegate();

    await taskRoutes.change(app, bruno.cookie, task.id, 'complete').expect(200);

    const [[createdForAna], [createdForBruno]] = await Promise.all(
      created.map((events) => waitForCount(events, 1)),
    );
    expect(createdForAna.notification).toBeNull();
    expect(createdForBruno.notification).toEqual({
      id: expect.any(String) as string,
      kind: 'received',
    });
    const [[updatedForAna], [updatedForBruno]] = await Promise.all(
      updated.map((events) => waitForCount(events, 1)),
    );
    expect(updatedForAna.notification).toMatchObject({ kind: 'completed' });
    expect(updatedForBruno.notification).toBeNull();
    const [counts] = await waitForCount(unread, 1);
    expect(counts.task_count).toBe(1);
  });
});
