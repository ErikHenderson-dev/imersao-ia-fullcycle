import { INestApplication } from '@nestjs/common';
import { authRoutes } from './support/auth-routes';
import { botRoutes } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type ReadMessage = {
  id: string;
  author: { name: string; username: string };
  body: string;
  created_at: string;
};

type ReadBody = { messages: ReadMessage[]; total: number };

// A leitura do Recorte pelo bot (spec da F11, "Rotas do bot e credencial"; F11-T04, CA2).
describe('GET /v1/bot/requests/:id/messages', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // Um Canal com o histórico de duas horas atrás e o Pedido (a Mensagem dele é de agora).
  async function openRequest() {
    const member = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const other = await authRoutes.createPerson(app, { name: 'Bruno Lima' });
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const base = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const requestId = await botRoutes.openedRequestId(
      app,
      member.cookie,
      channel.id,
      bot.username,
    );
    return { member, other: other.person, channel, bot, base, requestId };
  }

  function bodiesOf(body: unknown): string[] {
    return (body as ReadBody).messages.map((message) => message.body);
  }

  function plus(base: Date, milliseconds: number): string {
    return new Date(base.getTime() + milliseconds).toISOString();
  }

  it('traz só as Mensagens de Pessoas não apagadas, da mais antiga para a mais nova', async () => {
    const { member, other, channel, bot, base, requestId } =
      await openRequest();
    const anaIds = await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: member.person.id,
      count: 3,
      startAt: base,
    });
    await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: other.id,
      count: 1,
      startAt: new Date(base.getTime() + 60_000),
    });
    await botRoutes.softDeleteMessage(app, anaIds[1]);
    await conversationRoutes.insertBotMessage(app, {
      conversationId: channel.id,
      botId: bot.id,
    });

    const response = await botRoutes.readMessages(app, requestId, {
      until: plus(base, 3_600_000),
    });

    expect(response.status).toBe(200);
    const body = response.body as ReadBody;
    expect(body.total).toBe(3);
    expect(body.messages).toEqual([
      {
        id: anaIds[0],
        author: { name: 'Ana Souza', username: member.person.username },
        body: 'Mensagem 1',
        created_at: base.toISOString(),
      },
      expect.objectContaining({ id: anaIds[2], body: 'Mensagem 3' }),
      expect.objectContaining({
        author: { name: 'Bruno Lima', username: other.username },
        body: 'Mensagem 1',
      }),
    ]);
  });

  it('filtra por since, inclusivo, e por until, exclusivo', async () => {
    const { member, channel, base, requestId } = await openRequest();
    await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: member.person.id,
      count: 4,
      startAt: base,
      stepMs: 60_000,
    });

    const response = await botRoutes.readMessages(app, requestId, {
      since: plus(base, 60_000),
      until: plus(base, 180_000),
    });

    expect(response.status).toBe(200);
    expect(bodiesOf(response.body)).toEqual(['Mensagem 2', 'Mensagem 3']);
    expect((response.body as ReadBody).total).toBe(2);
  });

  it('sem until, traz até a Mensagem do Pedido', async () => {
    const { channel, base, requestId, member } = await openRequest();
    await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: member.person.id,
      count: 1,
      startAt: base,
    });

    const response = await botRoutes.readMessages(app, requestId, {
      since: base.toISOString(),
    });

    expect(response.status).toBe(200);
    expect(bodiesOf(response.body)).toEqual(['Mensagem 1', expect.any(String)]);
    expect(bodiesOf(response.body)[1]).toMatch(/resume hoje$/);
  });

  it('filtra por author_username', async () => {
    const { member, other, channel, base, requestId } = await openRequest();
    await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: member.person.id,
      count: 2,
      startAt: base,
    });
    await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: other.id,
      count: 2,
      startAt: new Date(base.getTime() + 60_000),
    });

    const response = await botRoutes.readMessages(app, requestId, {
      author_username: other.username,
    });

    expect(response.status).toBe(200);
    const body = response.body as ReadBody;
    expect(body.total).toBe(2);
    expect(body.messages.map((message) => message.author.name)).toEqual([
      'Bruno Lima',
      'Bruno Lima',
    ]);
  });

  it('responde vazio, com total 0, para um @usuário sem Mensagens', async () => {
    const { requestId } = await openRequest();

    const response = await botRoutes.readMessages(app, requestId, {
      author_username: 'ninguem-escreveu',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ messages: [], total: 0 });
  });

  it('corta nas 500 mais recentes com o total do Recorte', async () => {
    const { member, channel, base, requestId } = await openRequest();
    await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: member.person.id,
      count: 503,
      startAt: base,
    });

    const response = await botRoutes.readMessages(app, requestId, {
      until: plus(base, 3_600_000),
    });

    expect(response.status).toBe(200);
    const body = response.body as ReadBody;
    expect(body.total).toBe(503);
    expect(body.messages).toHaveLength(500);
    expect(body.messages[0].body).toBe('Mensagem 4');
    expect(body.messages[499].body).toBe('Mensagem 503');
  });

  it('responde 401 invalid_bot_token sem a credencial', async () => {
    const { requestId } = await openRequest();

    const response = await botRoutes.readMessages(app, requestId, {}, null);

    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe('invalid_bot_token');
  });

  it('responde 410 request_expired com o Pedido vencido', async () => {
    const { requestId } = await openRequest();
    await botRoutes.updateRequest(app, requestId, {
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await botRoutes.readMessages(app, requestId);

    expect(response.status).toBe(410);
    expect((response.body as { code: string }).code).toBe('request_expired');
  });

  it('responde 400 validation_failed com since inválido', async () => {
    const { requestId } = await openRequest();

    const response = await botRoutes.readMessages(app, requestId, {
      since: 'ontem',
    });

    expect(response.status).toBe(400);
    expect((response.body as { code: string }).code).toBe('validation_failed');
  });
});
