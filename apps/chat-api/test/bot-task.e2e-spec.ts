import { INestApplication } from '@nestjs/common';
import { authRoutes } from './support/auth-routes';
import { botRoutes } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type TaskBody = {
  task: {
    id: string;
    title: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    assignee: { id: string; name: string; username: string };
    delegator: { id: string; name: string; username: string };
    conversation: { id: string; name: string | null; kind: string };
    trigger_message: { id: string; deleted: boolean };
  };
  message: {
    id: string;
    author: { kind: string };
    body: string;
    mentions: unknown[];
  };
};

const TITLE = 'revisar o contrato até sexta';

// A delegação pelo bot (spec da F12, "Ação `task`"; F12-T01, CA1 a CA4).
describe('Ação task do bot', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // A Ana pede ao bot num Canal em que o Bruno também é Membro.
  async function openRequest() {
    const ana = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const bruno = await authRoutes.createPerson(app, { name: 'Bruno Lima' });
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const requestId = await botRoutes.openedRequestId(
      app,
      ana.cookie,
      channel.id,
      bot.username,
    );
    const [request] = await botRoutes.requestRows(app, channel.id);
    return {
      ana: ana.person,
      bruno: bruno.person,
      channel,
      bot,
      requestId,
      triggerMessageId: request.trigger_message_id,
    };
  }

  it('grava a Tarefa aberta com o Responsável e quem delegou', async () => {
    const { ana, bruno, channel, requestId, triggerMessageId } =
      await openRequest();

    await botRoutes
      .task(app, requestId, {
        assignee_username: bruno.username,
        title: TITLE,
      })
      .expect(201);

    expect(await botRoutes.taskRows(app, channel.id)).toEqual([
      expect.objectContaining({
        request_id: requestId,
        conversation_id: channel.id,
        trigger_message_id: triggerMessageId,
        assignee_id: bruno.id,
        delegator_id: ana.id,
        title: TITLE,
        status: 'open',
        completed_at: null,
      }),
    ]);
  });

  it('responde 201 com a Tarefa e a confirmação do bot', async () => {
    const { ana, bruno, channel, requestId, triggerMessageId } =
      await openRequest();

    const response = await botRoutes.task(app, requestId, {
      assignee_username: bruno.username,
      title: `  ${TITLE}  `,
    });

    expect(response.status).toBe(201);
    const body = response.body as TaskBody;
    expect(body.task).toEqual({
      id: expect.any(String) as string,
      title: TITLE,
      status: 'open',
      created_at: expect.any(String) as string,
      completed_at: null,
      assignee: { id: bruno.id, name: 'Bruno Lima', username: bruno.username },
      delegator: { id: ana.id, name: 'Ana Souza', username: ana.username },
      conversation: {
        id: channel.id,
        name: channel.name,
        kind: 'public_channel',
      },
      trigger_message: { id: triggerMessageId, deleted: false },
    });
    expect(body.message).toMatchObject({
      author: { kind: 'bot' },
      body: `Tarefa delegada a Bruno Lima: ${TITLE}`,
      mentions: [],
    });
    expect(await botRoutes.actionRows(app, requestId)).toEqual([
      { action_type: 'task', message_id: body.message.id },
    ]);
  });

  it('repetir devolve a mesma Tarefa', async () => {
    const { ana, bruno, channel, requestId } = await openRequest();
    const first = await botRoutes
      .task(app, requestId, { assignee_username: bruno.username, title: TITLE })
      .expect(201);

    const response = await botRoutes.task(app, requestId, {
      assignee_username: ana.username,
      title: 'outra coisa',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(first.body);
    expect(await botRoutes.taskRows(app, channel.id)).toHaveLength(1);
    expect(
      await botRoutes.countMessages(app, channel.id, { botOnly: true }),
    ).toBe(1);
  });

  it.each([
    ['sem a credencial', 401, 'invalid_bot_token'],
    ['com id desconhecido', 404, 'request_not_found'],
    ['com o Pedido vencido', 410, 'request_expired'],
    ['com o Pedido encerrado', 409, 'request_closed'],
  ])(
    'recusa como as outras ações do bot: %s',
    async (scenario, status, code) => {
      const { bruno, channel, requestId } = await openRequest();
      let target = requestId;
      if (scenario === 'com id desconhecido') {
        target = '0190f1a0-0000-7000-8000-000000000000';
      }
      if (scenario === 'com o Pedido vencido') {
        await botRoutes.updateRequest(app, requestId, {
          expiresAt: new Date(Date.now() - 1000),
        });
      }
      if (scenario === 'com o Pedido encerrado') {
        await botRoutes.updateRequest(app, requestId, { status: 'failed' });
      }
      const token = scenario === 'sem a credencial' ? null : undefined;

      const response = await botRoutes.task(
        app,
        target,
        { assignee_username: bruno.username, title: TITLE },
        token,
      );

      expect(response.status).toBe(status);
      expect(response.body).toMatchObject({ code });
      expect(await botRoutes.taskRows(app, channel.id)).toEqual([]);
    },
  );

  it.each([
    ['uma Pessoa que não é Membro', 'outsider'],
    ['um @usuário que não existe', 'ninguem-aqui'],
  ])('responde 422 assignee_not_member para %s', async (_, kind) => {
    const { channel, requestId } = await openRequest();
    // Criada depois do Canal, a Pessoa não é Membro dele.
    const outsider = await authRoutes.createPerson(app, { name: 'Caio Dias' });
    const username =
      kind === 'outsider' ? outsider.person.username : 'ninguem-aqui';

    const response = await botRoutes.task(app, requestId, {
      assignee_username: username,
      title: TITLE,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'assignee_not_member' });
    expect(await botRoutes.taskRows(app, channel.id)).toEqual([]);
    expect(
      await botRoutes.countMessages(app, channel.id, { botOnly: true }),
    ).toBe(0);
  });

  it('responde 422 assignee_is_bot', async () => {
    const { bot, channel, requestId } = await openRequest();

    const response = await botRoutes.task(app, requestId, {
      assignee_username: bot.username,
      title: TITLE,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'assignee_is_bot' });
    expect(await botRoutes.taskRows(app, channel.id)).toEqual([]);
  });

  it.each([
    ['vazio', ''],
    ['só de espaços', '   '],
    ['acima de 120 caracteres', 'a'.repeat(121)],
  ])('responde 400 com o título %s', async (_, title) => {
    const { bruno, channel, requestId } = await openRequest();

    const response = await botRoutes.task(app, requestId, {
      assignee_username: bruno.username,
      title,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
    expect(await botRoutes.taskRows(app, channel.id)).toEqual([]);
  });

  it('delega a quem pediu', async () => {
    const { ana, channel, requestId } = await openRequest();

    const response = await botRoutes.task(app, requestId, {
      assignee_username: ana.username,
      title: TITLE,
    });

    expect(response.status).toBe(201);
    expect((response.body as TaskBody).message.body).toBe(
      `Tarefa delegada a Ana Souza: ${TITLE}`,
    );
    expect(await botRoutes.taskRows(app, channel.id)).toEqual([
      expect.objectContaining({ assignee_id: ana.id, delegator_id: ana.id }),
    ]);
  });
});
