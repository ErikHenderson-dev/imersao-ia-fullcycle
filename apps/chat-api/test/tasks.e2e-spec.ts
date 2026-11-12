import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { TaskResponse } from '../src/tasks/task.response';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';
import { taskRoutes } from './support/task-routes';

type ListBody = { tasks: TaskResponse[]; next_cursor: string | null };

// Listar, concluir e reabrir Tarefas (spec da F12, "Concluir, reabrir e listar"; F12-T02, CA1, CA2
// e CA4).
describe('Tarefas', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // A Ana delega ao Bruno num Canal com os dois e o bot.
  async function setup() {
    const ana = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const bruno = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const { channel, bot } = await taskRoutes.channelWithBot(app);
    const delegate = (assigneeUsername: string, title?: string) =>
      taskRoutes.delegated(app, {
        delegatorCookie: ana.cookie,
        conversationId: channel.id,
        botUsername: bot.username,
        assigneeUsername,
        title,
      });
    return { ana, bruno, channel, delegate };
  }

  it('lista as abertas primeiro e pagina pelo cursor', async () => {
    const { bruno, delegate } = await setup();
    const older = await delegate(bruno.person.username, 'primeira');
    const done = await delegate(bruno.person.username, 'concluída');
    const newer = await delegate(bruno.person.username, 'terceira');
    await taskRoutes.change(app, bruno.cookie, done.id, 'complete').expect(200);
    const first = await taskRoutes
      .list(app, bruno.cookie, { role: 'assigned', limit: '2' })
      .expect(200);
    const cursor = (first.body as ListBody).next_cursor!;

    const response = await taskRoutes.list(app, bruno.cookie, {
      role: 'assigned',
      limit: '2',
      cursor,
    });

    expect(response.status).toBe(200);
    expect((first.body as ListBody).tasks.map((task) => task.id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect(response.body).toEqual({
      tasks: [expect.objectContaining({ id: done.id, status: 'done' })],
      next_cursor: null,
    });
  });

  it('a Tarefa a si mesmo aparece nas duas listas', async () => {
    const { ana, delegate } = await setup();
    const own = await delegate(ana.person.username);
    const delegated = await taskRoutes
      .list(app, ana.cookie, { role: 'delegated' })
      .expect(200);

    const response = await taskRoutes.list(app, ana.cookie, {
      role: 'assigned',
    });

    expect((response.body as ListBody).tasks.map((task) => task.id)).toEqual([
      own.id,
    ]);
    expect((delegated.body as ListBody).tasks.map((task) => task.id)).toEqual([
      own.id,
    ]);
  });

  it('devolve a Tarefa ao Responsável e a quem delegou', async () => {
    const { ana, bruno, delegate } = await setup();
    const task = await delegate(bruno.person.username);
    const toAna = await taskRoutes.get(app, ana.cookie, task.id).expect(200);

    const response = await taskRoutes.get(app, bruno.cookie, task.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ task });
    expect(toAna.body).toEqual({ task });
  });

  it('responde 404 task_not_found a um terceiro', async () => {
    const { bruno, delegate } = await setup();
    const task = await delegate(bruno.person.username);
    const other = await authRoutes.loggedIn(app);

    const response = await taskRoutes.get(app, other.cookie, task.id);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'task_not_found' });
  });

  it.each([
    ['sem Sessão', null, { role: 'assigned' }, 401],
    ['sem role', 'cookie', {}, 400],
    ['com role inválido', 'cookie', { role: 'todas' }, 400],
    ['com cursor inválido', 'cookie', { role: 'assigned', cursor: 'x' }, 400],
  ])('valida role e cursor: %s', async (_, cookie, query, status) => {
    const { bruno } = await setup();

    const response = await taskRoutes.list(
      app,
      cookie === null ? null : bruno.cookie,
      query,
    );

    expect(response.status).toBe(status);
  });

  it('o Responsável conclui e reabre', async () => {
    const { bruno, delegate } = await setup();
    const task = await delegate(bruno.person.username);
    const completed = await taskRoutes
      .change(app, bruno.cookie, task.id, 'complete')
      .expect(200);

    const response = await taskRoutes.change(
      app,
      bruno.cookie,
      task.id,
      'reopen',
    );

    expect((completed.body as { task: TaskResponse }).task).toMatchObject({
      status: 'done',
      completed_at: expect.any(String) as string,
    });
    expect(response.status).toBe(200);
    expect((response.body as { task: TaskResponse }).task).toMatchObject({
      status: 'open',
      completed_at: null,
    });
  });

  it('repetir não muda nada', async () => {
    const { bruno, delegate } = await setup();
    const task = await delegate(bruno.person.username);
    await taskRoutes.change(app, bruno.cookie, task.id, 'complete').expect(200);
    const before = await updatedAt(task.id);

    const response = await taskRoutes.change(
      app,
      bruno.cookie,
      task.id,
      'complete',
    );

    expect(response.status).toBe(200);
    expect((response.body as { task: TaskResponse }).task.status).toBe('done');
    expect(await updatedAt(task.id)).toEqual(before);
  });

  it('responde 403 task_not_assignee a quem delegou', async () => {
    const { ana, bruno, delegate } = await setup();
    const task = await delegate(bruno.person.username);

    const response = await taskRoutes.change(
      app,
      ana.cookie,
      task.id,
      'complete',
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'task_not_assignee' });
  });

  it('responde 404 task_not_found a um terceiro ao concluir', async () => {
    const { bruno, delegate } = await setup();
    const task = await delegate(bruno.person.username);
    const other = await authRoutes.loggedIn(app);

    const response = await taskRoutes.change(
      app,
      other.cookie,
      task.id,
      'complete',
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'task_not_found' });
  });

  it('a Tarefa diz que o Pedido foi apagado', async () => {
    const { ana, bruno, channel, delegate } = await setup();
    const task = await delegate(bruno.person.username);
    await conversationRoutes
      .deleteMessage(app, ana.cookie, channel.id, task.trigger_message.id)
      .expect(204);

    const response = await taskRoutes.list(app, bruno.cookie, {
      role: 'assigned',
    });

    expect((response.body as ListBody).tasks[0].trigger_message).toEqual({
      id: task.trigger_message.id,
      deleted: true,
    });
  });

  async function updatedAt(taskId: string): Promise<Date> {
    const [row] = await app
      .get(DataSource)
      .query<{ updated_at: Date }[]>(
        'SELECT updated_at FROM tasks WHERE id = $1',
        [taskId],
      );
    return row.updated_at;
  }
});
