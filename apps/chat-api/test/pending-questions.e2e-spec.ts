import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { authRoutes } from './support/auth-routes';
import { botRoutes } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type AgentRequestBody = {
  id: string;
  kind: string;
  bot_username: string;
  parent_request_id: string | null;
};

type SendBody = {
  message: { id: string };
  agent_request: AgentRequestBody | null;
};

// A Pergunta pendente no envio (spec da F11, "Envio e Pergunta pendente"; LLD, "Pedido ao agente e
// Pergunta pendente"; F11-T07, CA3 e CA4).
describe('Pergunta pendente no envio', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // A Ana pediu ao bot, que perguntou; o Bruno é Membro do mesmo Canal.
  async function askedQuestion() {
    const ana = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const bruno = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const { requestId, questionId } = await botRoutes.openQuestion(
      app,
      ana.cookie,
      channel.id,
      bot.username,
    );
    return { ana, bruno, channel, bot, requestId, questionId };
  }

  async function isOpen(conversationId: string, questionId: string) {
    const rows = await botRoutes.pendingQuestionRows(app, conversationId);
    return (
      rows.find((row) => row.question_message_id === questionId)!.closed_at ===
      null
    );
  }

  it('a resposta sem Menção vira continuação e encerra a pergunta', async () => {
    const { ana, channel, bot, requestId, questionId } = await askedQuestion();

    const response = await conversationRoutes.sendMessage(
      app,
      ana.cookie,
      channel.id,
      { body: 'Hoje (1)' },
    );

    expect(response.status).toBe(201);
    const body = response.body as SendBody;
    expect(body.agent_request).toEqual({
      id: expect.any(String) as string,
      kind: 'continuation',
      bot_username: bot.username,
      parent_request_id: requestId,
    });
    expect(await isOpen(channel.id, questionId)).toBe(false);
    const rows = await botRoutes.requestRows(app, channel.id);
    expect(rows.find((row) => row.id === body.agent_request!.id)).toMatchObject(
      {
        kind: 'continuation',
        parent_request_id: requestId,
        trigger_message_id: body.message.id,
        status: 'open',
      },
    );
  });

  it('o reenvio devolve a mesma continuação', async () => {
    const { ana, channel } = await askedQuestion();
    const clientId = randomUUID();
    const first = await conversationRoutes
      .sendMessage(app, ana.cookie, channel.id, { clientId, body: 'Hoje (1)' })
      .expect(201);

    const response = await conversationRoutes.sendMessage(
      app,
      ana.cookie,
      channel.id,
      { clientId, body: 'Hoje (1)' },
    );

    expect(response.status).toBe(201);
    expect((response.body as SendBody).agent_request).toEqual(
      (first.body as SendBody).agent_request,
    );
    expect(await botRoutes.requestRows(app, channel.id)).toHaveLength(2);
  });

  it('a Menção ao Agente encerra a pergunta e cria um Pedido new', async () => {
    const { ana, channel, bot, questionId } = await askedQuestion();

    const response = await botRoutes.sendMention(
      app,
      ana.cookie,
      channel.id,
      bot.username,
    );

    expect(response.status).toBe(201);
    expect((response.body as SendBody).agent_request).toMatchObject({
      kind: 'new',
      parent_request_id: null,
    });
    expect(await isOpen(channel.id, questionId)).toBe(false);
  });

  it('a Mensagem de outro Membro não encerra a pergunta', async () => {
    const { bruno, channel, questionId } = await askedQuestion();

    const response = await conversationRoutes.sendMessage(
      app,
      bruno.cookie,
      channel.id,
      { body: 'Hoje (1)' },
    );

    expect(response.status).toBe(201);
    expect((response.body as SendBody).agent_request).toBeNull();
    expect(await isOpen(channel.id, questionId)).toBe(true);
  });

  it('a pergunta vencida não vira continuação', async () => {
    const { ana, channel, questionId } = await askedQuestion();
    await botRoutes.expireQuestion(app, questionId);

    const response = await conversationRoutes.sendMessage(
      app,
      ana.cookie,
      channel.id,
      { body: 'Hoje (1)' },
    );

    expect(response.status).toBe(201);
    expect((response.body as SendBody).agent_request).toBeNull();
    expect(await botRoutes.requestRows(app, channel.id)).toHaveLength(1);
  });

  it('depois de encerrada, a Mensagem sem Menção não chama o Agente', async () => {
    const { ana, channel } = await askedQuestion();
    await conversationRoutes
      .sendMessage(app, ana.cookie, channel.id, { body: 'Hoje (1)' })
      .expect(201);

    const response = await conversationRoutes.sendMessage(
      app,
      ana.cookie,
      channel.id,
      { body: 'A semana (1)' },
    );

    expect(response.status).toBe(201);
    expect((response.body as SendBody).agent_request).toBeNull();
  });

  it('dois envios simultâneos criam um Pedido só', async () => {
    const { ana, channel } = await askedQuestion();

    const responses = await Promise.all(
      ['Hoje (1)', 'Tudo (1)'].map((body) =>
        conversationRoutes.sendMessage(app, ana.cookie, channel.id, { body }),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const requests = responses.flatMap(
      (response) => (response.body as SendBody).agent_request ?? [],
    );
    expect(requests).toHaveLength(1);
    const rows = await botRoutes.requestRows(app, channel.id);
    expect(rows.filter((row) => row.kind === 'continuation')).toHaveLength(1);
  });

  it('o histórico traz a pergunta encerrada', async () => {
    const { ana, channel, questionId } = await askedQuestion();
    await conversationRoutes
      .sendMessage(app, ana.cookie, channel.id, { body: 'Hoje (1)' })
      .expect(201);

    const response = await conversationRoutes.listMessages(
      app,
      ana.cookie,
      channel.id,
    );

    expect(response.status).toBe(200);
    const messages = (
      response.body as {
        messages: { id: string; quick_replies: unknown }[];
      }
    ).messages;
    expect(messages.map((message) => message.quick_replies)).toEqual([
      null,
      {
        options: ['Hoje (1)', 'Desde ontem (1)', 'A semana (1)', 'Tudo (1)'],
        owner_id: ana.person.id,
        expires_at: expect.any(String) as string,
        closed: true,
      },
      null,
    ]);
    expect(messages[1].id).toBe(questionId);
  });
});
