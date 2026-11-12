import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';
import { taskRoutes } from './support/task-routes';

type Item = {
  kind: string;
  message?: { id: string };
  notification?: { id: string; kind: string; read: boolean };
  task?: { id: string };
  actor?: { id: string; name: string };
};

// As Notificações de Tarefa (spec da F12, "Tarefa" e "Atividade"; F12-T03, CA1 a CA3 e CA8).
describe('Notificações de Tarefa', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function setup() {
    const ana = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const bruno = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const { channel, bot } = await taskRoutes.channelWithBot(app);
    const delegate = (assigneeUsername: string) =>
      taskRoutes.delegated(app, {
        delegatorCookie: ana.cookie,
        conversationId: channel.id,
        botUsername: bot.username,
        assigneeUsername,
      });
    return { ana, bruno, channel, delegate };
  }

  function rows(recipientId: string) {
    return app
      .get(DataSource)
      .query<{ kind: string; task_id: string; read_at: Date | null }[]>(
        'SELECT kind, task_id, read_at FROM task_notifications WHERE recipient_id = $1 ORDER BY id',
        [recipientId],
      );
  }

  function activity(cookie: string, kind = 'all') {
    return request(app.getHttpServer() as App)
      .get('/v1/activity')
      .query({ kind })
      .set('Cookie', cookie);
  }

  function unread(cookie: string) {
    return request(app.getHttpServer() as App)
      .get('/v1/activity/unread')
      .set('Cookie', cookie);
  }

  function readOne(cookie: string, id: string) {
    return request(app.getHttpServer() as App)
      .put(`/v1/activity/task-notifications/${id}/read`)
      .set('Cookie', cookie);
  }

  function readAll(cookie: string, body: object) {
    return request(app.getHttpServer() as App)
      .put('/v1/activity/read')
      .set('Cookie', cookie)
      .send(body);
  }

  async function firstTaskNotificationId(cookie: string): Promise<string> {
    const response = await activity(cookie).expect(200);
    const item = (response.body as { items: Item[] }).items.find(
      (entry) => entry.kind === 'task',
    );
    return item!.notification!.id;
  }

  it('a Tarefa notifica o Responsável, e a conclusão e a reabertura, quem delegou', async () => {
    const { ana, bruno, delegate } = await setup();
    const task = await delegate(bruno.person.username);
    await taskRoutes.change(app, bruno.cookie, task.id, 'complete').expect(200);

    await taskRoutes.change(app, bruno.cookie, task.id, 'reopen').expect(200);

    expect(await rows(bruno.person.id)).toEqual([
      { kind: 'received', task_id: task.id, read_at: null },
    ]);
    expect((await rows(ana.person.id)).map((row) => row.kind)).toEqual([
      'completed',
      'reopened',
    ]);
  });

  it('ninguém é notificado da própria ação', async () => {
    const { ana, delegate } = await setup();
    const task = await delegate(ana.person.username);

    await taskRoutes.change(app, ana.cookie, task.id, 'complete').expect(200);

    expect(await rows(ana.person.id)).toEqual([]);
  });

  it('duas conclusões simultâneas notificam uma vez', async () => {
    const { ana, bruno, delegate } = await setup();
    const task = await delegate(bruno.person.username);

    await Promise.all([
      taskRoutes.change(app, bruno.cookie, task.id, 'complete').expect(200),
      taskRoutes.change(app, bruno.cookie, task.id, 'complete').expect(200),
    ]);

    expect((await rows(ana.person.id)).map((row) => row.kind)).toEqual([
      'completed',
    ]);
  });

  it('a Atividade traz as Notificações de Tarefa na aba Todas', async () => {
    const { ana, bruno, channel, delegate } = await setup();
    const mentionId = await conversationRoutes.sentId(
      app,
      ana.cookie,
      channel.id,
      `@${bruno.person.username} olha isso`,
    );
    const task = await delegate(bruno.person.username);
    const mentions = await activity(bruno.cookie, 'mentions').expect(200);

    const response = await activity(bruno.cookie);

    expect(response.status).toBe(200);
    const items = (response.body as { items: Item[] }).items;
    expect(items.map((item) => item.kind)).toEqual(['mention', 'task']);
    expect(items[0].message!.id).toBe(mentionId);
    expect(items[1]).toMatchObject({
      notification: { kind: 'received', read: false },
      task: { id: task.id },
      actor: { id: ana.person.id, name: 'Ana Souza' },
    });
    expect(
      (mentions.body as { items: Item[] }).items.some((i) => i.kind === 'task'),
    ).toBe(false);
  });

  it('o task_count entra no total', async () => {
    const { bruno, delegate } = await setup();
    await delegate(bruno.person.username);

    const response = await unread(bruno.cookie);

    expect(response.body).toMatchObject({
      task_count: 1,
      mention_count: 0,
      total_count: 1,
    });
  });

  it('marca uma Notificação de Tarefa como lida', async () => {
    const { bruno, delegate } = await setup();
    await delegate(bruno.person.username);
    const id = await firstTaskNotificationId(bruno.cookie);

    const response = await readOne(bruno.cookie, id);

    expect(response.status).toBe(204);
    await readOne(bruno.cookie, id).expect(204);
    expect((await unread(bruno.cookie).expect(200)).body).toMatchObject({
      task_count: 0,
    });
    const items = (
      (await activity(bruno.cookie).expect(200)).body as { items: Item[] }
    ).items;
    expect(items.find((item) => item.kind === 'task')!.notification!.read).toBe(
      true,
    );
  });

  it.each([
    ['de outra Pessoa', 'other'],
    ['inexistente', 'missing'],
  ])('só o destinatário marca: %s', async (_, scenario) => {
    const { ana, bruno, delegate } = await setup();
    await delegate(bruno.person.username);
    const id =
      scenario === 'other'
        ? await firstTaskNotificationId(bruno.cookie)
        : '0190f1a0-0000-7000-8000-000000000000';

    const response = await readOne(ana.cookie, id);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'not_found' });
  });

  it('marcar tudo com uma Notificação de Tarefa', async () => {
    const { ana, bruno, delegate } = await setup();
    await delegate(bruno.person.username);
    const id = await firstTaskNotificationId(bruno.cookie);
    const foreign = await readAll(ana.cookie, { task_notification_id: id });

    const response = await readAll(bruno.cookie, { task_notification_id: id });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      mention_count: 0,
      task_count: 0,
      total_count: 0,
    });
    expect(foreign.status).toBe(404);
    expect(foreign.body).toMatchObject({ code: 'message_not_found' });
  });
});
