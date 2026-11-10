import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type ConversationBody = {
  id: string;
  kind: string;
  name: string | null;
  topic: string | null;
  member_count: number;
};

describe('conversas', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  const loggedIn = () => authRoutes.loggedIn(app);

  describe('GET /v1/conversations', () => {
    it('lista só as Conversas de que a Pessoa é Membro, na ordem alfabética do pt-BR', async () => {
      const { person, cookie } = await loggedIn();
      const suffix = randomUUID();
      const names = ['zebra', 'árvore', '_meio', 'abelha'].map(
        (prefix) => `${prefix}-${suffix}`,
      );
      const channels: { id: string }[] = [];
      for (const name of names) {
        channels.push(await conversationRoutes.createChannel(app, { name }));
      }
      const outside = await conversationRoutes.createChannel(app);
      await conversationRoutes.removeMembership(app, outside.id, person.id);
      const ownIds = [...channels.map((channel) => channel.id), outside.id];

      const response = await request(server)
        .get('/v1/conversations')
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      const listed = (
        response.body as { conversations: ConversationBody[] }
      ).conversations
        .filter((conversation) => ownIds.includes(conversation.id))
        .map((conversation) => conversation.name);
      // O banco (en_US.utf8) ignora o "_" e poria _meio entre árvore e zebra.
      expect(listed).toEqual([
        `_meio-${suffix}`,
        `abelha-${suffix}`,
        `árvore-${suffix}`,
        `zebra-${suffix}`,
      ]);
    });

    it('cada Conversa traz a quantidade de Membros', async () => {
      const { cookie } = await loggedIn();
      const channel = await conversationRoutes.createChannel(app);
      const [{ count }] = await app
        .get(DataSource)
        .query<{ count: string }[]>(
          'SELECT count(*) FROM conversation_members WHERE conversation_id = $1',
          [channel.id],
        );

      const response = await request(server)
        .get('/v1/conversations')
        .set('Cookie', cookie);

      const listed = (
        response.body as { conversations: ConversationBody[] }
      ).conversations.find((conversation) => conversation.id === channel.id);
      expect(listed?.member_count).toBe(Number(count));
    });

    it('responde 401 sem Sessão', async () => {
      const response = await request(server).get('/v1/conversations');

      expect(response.status).toBe(401);
      expect((response.body as { code: string }).code).toBe('unauthenticated');
    });
  });

  describe('GET /v1/conversations/:id', () => {
    it('responde 200 com a Conversa para um Membro', async () => {
      const { cookie } = await loggedIn();
      const channel = await conversationRoutes.createChannel(app, {
        topic: 'Conversas do time',
      });

      const response = await request(server)
        .get(`/v1/conversations/${channel.id}`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        conversation: {
          id: channel.id,
          kind: 'public_channel',
          name: channel.name,
          topic: 'Conversas do time',
          member_count: expect.any(Number) as number,
          counterpart: null,
        },
      });
    });

    it('responde 404 para id inexistente, id malformado e Pessoa sem participação, com o mesmo corpo', async () => {
      const { person, cookie } = await loggedIn();
      const outside = await conversationRoutes.createChannel(app);
      await conversationRoutes.removeMembership(app, outside.id, person.id);

      const responses = await Promise.all(
        [randomUUID(), 'nao-e-um-uuid', outside.id].map((id) =>
          request(server).get(`/v1/conversations/${id}`).set('Cookie', cookie),
        ),
      );

      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(response.body).toEqual(responses[0].body);
      }
      expect((responses[0].body as { code: string }).code).toBe(
        'conversation_not_found',
      );
    });

    it('responde 401 sem Sessão', async () => {
      const response = await request(server).get(
        `/v1/conversations/${randomUUID()}`,
      );

      expect(response.status).toBe(401);
    });
  });
});
