import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
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

// O Pedido criado pelo envio (spec da F11, "Envio e Pergunta pendente"; F11-T03, CA1).
describe('Pedido no envio da Mensagem', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function memberWithBot() {
    const member = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app);
    return { member, channel, bot };
  }

  it('o envio com agent_username cria um Pedido new', async () => {
    const { member, channel, bot } = await memberWithBot();

    const response = await botRoutes.sendMention(
      app,
      member.cookie,
      channel.id,
      bot.username,
    );

    expect(response.status).toBe(201);
    const body = response.body as SendBody;
    expect(body.agent_request).toEqual({
      id: expect.any(String) as string,
      kind: 'new',
      bot_username: bot.username,
      parent_request_id: null,
    });
    const [row] = await botRoutes.requestRows(app, channel.id);
    expect(row).toMatchObject({
      id: body.agent_request!.id,
      requester_id: member.person.id,
      bot_id: bot.id,
      trigger_message_id: body.message.id,
      kind: 'new',
      parent_request_id: null,
      status: 'open',
    });
    expect(row.expires_at.getTime() - row.created_at.getTime()).toBeCloseTo(
      120_000,
      -3,
    );
  });

  it('o reenvio devolve o mesmo Pedido', async () => {
    const { member, channel, bot } = await memberWithBot();
    const clientId = randomUUID();
    const first = await botRoutes
      .sendMention(app, member.cookie, channel.id, bot.username, { clientId })
      .expect(201);

    const again = await botRoutes.sendMention(
      app,
      member.cookie,
      channel.id,
      bot.username,
      { clientId },
    );

    expect(again.status).toBe(201);
    expect((again.body as SendBody).agent_request).toEqual(
      (first.body as SendBody).agent_request,
    );
    expect(await botRoutes.requestRows(app, channel.id)).toHaveLength(1);
  });

  it.each([
    ['de uma Pessoa', (username: string) => username],
    ['de ninguém', () => 'ninguem-com-esse-usuario'],
  ])(
    'responde 422 bot_not_found quando agent_username é %s',
    async (_case, pick) => {
      const { member, channel } = await memberWithBot();

      const response = await botRoutes.sendMention(
        app,
        member.cookie,
        channel.id,
        pick(member.person.username),
      );

      expect(response.status).toBe(422);
      expect((response.body as { code: string }).code).toBe('bot_not_found');
      expect(await botRoutes.countMessages(app, channel.id)).toBe(0);
      expect(await botRoutes.requestRows(app, channel.id)).toHaveLength(0);
    },
  );

  it('responde 400 com agent_username nulo', async () => {
    const { member, channel } = await memberWithBot();

    const response = await request(app.getHttpServer() as App)
      .post(`/v1/conversations/${channel.id}/messages`)
      .set('Cookie', member.cookie)
      .send({ client_id: randomUUID(), body: 'Oi', agent_username: null });

    expect(response.status).toBe(400);
    expect((response.body as { code: string }).code).toBe('validation_failed');
    expect(await botRoutes.countMessages(app, channel.id)).toBe(0);
  });

  it('sem agent_username, agent_request é nulo', async () => {
    const { member, channel } = await memberWithBot();

    const response = await conversationRoutes.sendMessage(
      app,
      member.cookie,
      channel.id,
      { body: 'Bom dia' },
    );

    expect(response.status).toBe(201);
    expect((response.body as SendBody).agent_request).toBeNull();
    expect(await botRoutes.requestRows(app, channel.id)).toHaveLength(0);
  });
});
