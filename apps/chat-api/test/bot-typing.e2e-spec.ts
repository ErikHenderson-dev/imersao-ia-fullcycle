import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { authRoutes } from './support/auth-routes';
import { botRoutes } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

// O "digitando" do bot pelas rotas /v1/bot (spec da F11, ""Digitando" do bot"; F11-T05, CA3). A
// emissão é provada pelo socket, em realtime-bot.e2e-spec.ts.
describe('POST /v1/bot/requests/:id/typing', () => {
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
    return { requestId };
  }

  it('responde 204 sem gravar ação', async () => {
    const { requestId } = await openRequest();

    const response = await botRoutes.typing(app, requestId);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(await botRoutes.countActions(app, requestId)).toBe(0);
  });

  it.each([
    ['sem a credencial', null],
    ['com a credencial errada', 'credencial-errada'],
  ])('responde 401 invalid_bot_token %s', async (_case, token) => {
    const { requestId } = await openRequest();

    const response = await botRoutes.typing(app, requestId, token);

    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe('invalid_bot_token');
  });

  it.each([
    ['desconhecido', randomUUID()],
    ['malformado', 'nao-e-um-uuid'],
  ])('responde 404 request_not_found com id %s', async (_case, id) => {
    const response = await botRoutes.typing(app, id);

    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe('request_not_found');
  });

  it('responde 410 request_expired depois da validade', async () => {
    const { requestId } = await openRequest();
    await botRoutes.updateRequest(app, requestId, {
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await botRoutes.typing(app, requestId);

    expect(response.status).toBe(410);
    expect((response.body as { code: string }).code).toBe('request_expired');
  });

  it.each(['failed', 'cancelled'])(
    'responde 409 request_closed com o Pedido %s',
    async (status) => {
      const { requestId } = await openRequest();
      await botRoutes.updateRequest(app, requestId, { status });

      const response = await botRoutes.typing(app, requestId);

      expect(response.status).toBe(409);
      expect((response.body as { code: string }).code).toBe('request_closed');
    },
  );
});
