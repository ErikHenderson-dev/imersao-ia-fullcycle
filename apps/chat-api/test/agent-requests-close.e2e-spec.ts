import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { authRoutes } from './support/auth-routes';
import { botRoutes } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

// O encerramento do Pedido pelo BFF (spec da F11, "Pedido e ações de bot"; F11-T06, CA3).
describe('POST /v1/agent-requests/:id/close', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function openRequest() {
    const member = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const requestId = await botRoutes.openedRequestId(
      app,
      member.cookie,
      channel.id,
      bot.username,
    );
    return { member, requestId };
  }

  it.each(['failed', 'cancelled'])(
    'encerra o Pedido de quem pediu como %s',
    async (status) => {
      const { member, requestId } = await openRequest();

      const response = await botRoutes.closeRequest(
        app,
        member.cookie,
        requestId,
        status,
      );

      expect(response.status).toBe(204);
      expect(await botRoutes.requestStatus(app, requestId)).toBe(status);
    },
  );

  it('encerrar de novo responde 204 sem mudar nada', async () => {
    const { member, requestId } = await openRequest();
    await botRoutes
      .closeRequest(app, member.cookie, requestId, 'failed')
      .expect(204);

    const response = await botRoutes.closeRequest(
      app,
      member.cookie,
      requestId,
      'cancelled',
    );

    expect(response.status).toBe(204);
    expect(await botRoutes.requestStatus(app, requestId)).toBe('failed');
  });

  it('responde 404 request_not_found para o Pedido de outra Pessoa', async () => {
    const { requestId } = await openRequest();
    const other = await authRoutes.loggedIn(app);

    const response = await botRoutes.closeRequest(
      app,
      other.cookie,
      requestId,
      'failed',
    );

    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe('request_not_found');
    expect(await botRoutes.requestStatus(app, requestId)).toBe('open');
  });

  it.each([
    ['desconhecido', randomUUID()],
    ['malformado', 'nao-e-um-uuid'],
  ])('responde 404 request_not_found com id %s', async (_case, id) => {
    const member = await authRoutes.loggedIn(app);

    const response = await botRoutes.closeRequest(
      app,
      member.cookie,
      id,
      'failed',
    );

    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe('request_not_found');
  });

  it('responde 401 sem Sessão', async () => {
    const { requestId } = await openRequest();

    const response = await botRoutes.closeRequest(
      app,
      null,
      requestId,
      'failed',
    );

    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe('unauthenticated');
  });

  it.each([['open'], [undefined], ['encerrado']])(
    'responde 400 com status %s',
    async (status) => {
      const { member, requestId } = await openRequest();

      const response = await botRoutes.closeRequest(
        app,
        member.cookie,
        requestId,
        status,
      );

      expect(response.status).toBe(400);
      expect((response.body as { code: string }).code).toBe(
        'validation_failed',
      );
      expect(await botRoutes.requestStatus(app, requestId)).toBe('open');
    },
  );

  it('depois do encerramento, a reply recebe request_closed', async () => {
    const { member, requestId } = await openRequest();
    await botRoutes
      .closeRequest(app, member.cookie, requestId, 'failed')
      .expect(204);

    const response = await botRoutes.reply(app, requestId, 'Olá');

    expect(response.status).toBe(409);
    expect((response.body as { code: string }).code).toBe('request_closed');
  });
});
