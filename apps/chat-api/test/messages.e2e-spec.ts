import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_PAGE_MAX_SIZE,
  MESSAGE_PAGE_SIZE,
} from '../src/messages/message-values';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type MessageBody = {
  id: string;
  conversation_id: string;
  client_id: string;
  author: { kind: string; id: string; name: string; username: string };
  body: string;
  created_at: string;
};

describe('mensagens', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  async function countByClientId(clientId: string): Promise<number> {
    const [row] = await app
      .get(DataSource)
      .query<{ count: string }[]>(
        'SELECT count(*) FROM messages WHERE client_id = $1',
        [clientId],
      );
    return Number(row.count);
  }

  async function memberOfNewChannel(name = 'Ana Souza') {
    const { person, email, password } = await authRoutes.createPerson(app, {
      name,
    });
    const token = await authRoutes.login(app, email, password);
    const channel = await conversationRoutes.createChannel(app);
    return { person, channel, cookie: authRoutes.sessionCookie(token) };
  }

  describe('GET /v1/conversations/:id/messages', () => {
    it('devolve a página mais recente em ordem cronológica, com has_more', async () => {
      const { person, channel, cookie } =
        await memberOfNewChannel('Bruno Lima');
      const ids = await conversationRoutes.insertMessages(app, {
        conversationId: channel.id,
        authorId: person.id,
        count: MESSAGE_PAGE_SIZE + 1,
      });

      const response = await request(server)
        .get(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      const body = response.body as {
        messages: MessageBody[];
        has_more: boolean;
      };
      expect(body.has_more).toBe(true);
      expect(body.messages.map((message) => message.id)).toEqual(ids.slice(1));
      expect(body.messages[0]).toMatchObject({
        conversation_id: channel.id,
        author: {
          kind: 'person',
          id: person.id,
          name: 'Bruno Lima',
          username: person.username,
        },
        body: 'Mensagem 2',
      });
    });

    it('traz o autor bot na Mensagem de bot e o autor Pessoa nas outras', async () => {
      const { person, channel, cookie } = await memberOfNewChannel('Bia Reis');
      const bot = await conversationRoutes.createBot(app, 'Assistente');
      await conversationRoutes.insertMessages(app, {
        conversationId: channel.id,
        authorId: person.id,
        count: 1,
      });
      await conversationRoutes.insertBotMessage(app, {
        conversationId: channel.id,
        botId: bot.id,
      });

      const response = await request(server)
        .get(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      const { messages } = response.body as { messages: MessageBody[] };
      expect(messages.map((message) => message.author)).toEqual([
        {
          kind: 'person',
          id: person.id,
          name: 'Bia Reis',
          username: person.username,
        },
        { kind: 'bot', id: bot.id, name: 'Assistente', username: bot.username },
      ]);
    });

    it('responde has_more falso quando a página tem o histórico inteiro', async () => {
      const { person, channel, cookie } = await memberOfNewChannel();
      await conversationRoutes.insertMessages(app, {
        conversationId: channel.id,
        authorId: person.id,
        count: 2,
      });

      const response = await request(server)
        .get(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie);

      const body = response.body as { messages: unknown[]; has_more: boolean };
      expect(body.messages).toHaveLength(2);
      expect(body.has_more).toBe(false);
    });

    it('devolve as Mensagens anteriores a before, em ordem cronológica', async () => {
      const { person, channel, cookie } = await memberOfNewChannel();
      const ids = await conversationRoutes.insertMessages(app, {
        conversationId: channel.id,
        authorId: person.id,
        count: 5,
      });

      const response = await request(server)
        .get(`/v1/conversations/${channel.id}/messages`)
        .query({ before: ids[3], limit: 2 })
        .set('Cookie', cookie);

      expect(response.status).toBe(200);
      const body = response.body as {
        messages: MessageBody[];
        has_more: boolean;
      };
      expect(body.messages.map((message) => message.id)).toEqual([
        ids[1],
        ids[2],
      ]);
      expect(body.has_more).toBe(true);
    });

    it('as páginas encadeadas cobrem o histórico inteiro sem repetir nem pular', async () => {
      const { person, channel, cookie } = await memberOfNewChannel();
      const ids = await conversationRoutes.insertMessages(app, {
        conversationId: channel.id,
        authorId: person.id,
        count: 7,
      });
      const pages: { messages: MessageBody[]; has_more: boolean }[] = [];
      let before: string | undefined;
      do {
        const response = await request(server)
          .get(`/v1/conversations/${channel.id}/messages`)
          .query({ limit: 3, ...(before ? { before } : {}) })
          .set('Cookie', cookie);
        pages.push(
          response.body as { messages: MessageBody[]; has_more: boolean },
        );
        before = pages.at(-1)!.messages[0]?.id;
      } while (pages.at(-1)!.has_more && pages.length < 10);

      const received = pages
        .toReversed()
        .flatMap((page) => page.messages.map((message) => message.id));
      expect(received).toEqual(ids);
      expect(pages.map((page) => page.has_more)).toEqual([true, true, false]);
    });

    it('usa o tamanho padrão e aceita o máximo', async () => {
      const { person, channel, cookie } = await memberOfNewChannel();
      await conversationRoutes.insertMessages(app, {
        conversationId: channel.id,
        authorId: person.id,
        count: MESSAGE_PAGE_MAX_SIZE + 1,
      });

      const [standard, maximum] = await Promise.all(
        [{}, { limit: MESSAGE_PAGE_MAX_SIZE }].map((query) =>
          request(server)
            .get(`/v1/conversations/${channel.id}/messages`)
            .query(query)
            .set('Cookie', cookie),
        ),
      );

      expect((standard.body as { messages: unknown[] }).messages).toHaveLength(
        MESSAGE_PAGE_SIZE,
      );
      expect((maximum.body as { messages: unknown[] }).messages).toHaveLength(
        MESSAGE_PAGE_MAX_SIZE,
      );
    });

    it.each([
      ['before que não é uuid', { before: 'abc' }],
      ['limit zero', { limit: 0 }],
      ['limit acima do máximo', { limit: MESSAGE_PAGE_MAX_SIZE + 1 }],
      ['limit que não é inteiro', { limit: 'dez' }],
    ])('recusa %s com validation_failed', async (_caso, query) => {
      const { channel, cookie } = await memberOfNewChannel();

      const response = await request(server)
        .get(`/v1/conversations/${channel.id}/messages`)
        .query(query)
        .set('Cookie', cookie);

      expect(response.status).toBe(400);
      expect((response.body as { code: string }).code).toBe(
        'validation_failed',
      );
    });

    it('responde 404 nas Mensagens de uma Conversa sem participação', async () => {
      const { person, channel, cookie } = await memberOfNewChannel();
      await conversationRoutes.removeMembership(app, channel.id, person.id);

      const response = await request(server)
        .get(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie);

      expect(response.status).toBe(404);
      expect((response.body as { code: string }).code).toBe(
        'conversation_not_found',
      );
    });

    it('responde 401 sem Sessão', async () => {
      const response = await request(server).get(
        `/v1/conversations/${randomUUID()}/messages`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /v1/conversations/:id/messages', () => {
    it('responde 201 e grava a Mensagem com a Pessoa da Sessão como autora', async () => {
      const { person, channel, cookie } =
        await memberOfNewChannel('Carla Dias');
      const clientId = randomUUID();

      const response = await request(server)
        .post(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie)
        .send({ client_id: clientId, body: 'Bom dia!\nTudo certo?' });

      expect(response.status).toBe(201);
      const { message } = response.body as { message: MessageBody };
      expect(message).toMatchObject({
        conversation_id: channel.id,
        client_id: clientId,
        author: {
          kind: 'person',
          id: person.id,
          name: 'Carla Dias',
          username: person.username,
        },
        body: 'Bom dia!\nTudo certo?',
      });
      const rows = await app
        .get(DataSource)
        .query<{ author_person_id: string; body: string }[]>(
          'SELECT author_person_id, body FROM messages WHERE id = $1',
          [message.id],
        );
      expect(rows).toEqual([
        { author_person_id: person.id, body: 'Bom dia!\nTudo certo?' },
      ]);
    });

    it('remove os espaços e as quebras de linha das pontas', async () => {
      const { channel, cookie } = await memberOfNewChannel();

      const response = await request(server)
        .post(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie)
        .send({ client_id: randomUUID(), body: '\n  Olá, time  \n' });

      expect(response.status).toBe(201);
      expect((response.body as { message: MessageBody }).message.body).toBe(
        'Olá, time',
      );
    });

    it.each([
      ['texto vazio', { client_id: randomUUID(), body: '' }],
      ['só espaços', { client_id: randomUUID(), body: '  \n ' }],
      ['sem client_id', { body: 'Olá' }],
      ['client_id que não é uuid', { client_id: 'abc', body: 'Olá' }],
      [
        'texto com o caractere nulo',
        { client_id: randomUUID(), body: 'a\u0000b' },
      ],
    ])('recusa %s com validation_failed', async (_caso, payload) => {
      const { channel, cookie } = await memberOfNewChannel();

      const response = await request(server)
        .post(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie)
        .send(payload);

      expect(response.status).toBe(400);
      expect((response.body as { code: string }).code).toBe(
        'validation_failed',
      );
    });

    it('o mesmo client_id devolve a Mensagem já gravada, sem gravar outra', async () => {
      const { channel, cookie } = await memberOfNewChannel();
      const clientId = randomUUID();
      const first = await request(server)
        .post(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie)
        .send({ client_id: clientId, body: 'Primeiro envio' });

      const repeated = await request(server)
        .post(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie)
        .send({ client_id: clientId, body: 'Reenvio com outro texto' });

      expect(repeated.status).toBe(201);
      const message = (repeated.body as { message: MessageBody }).message;
      expect(message.id).toBe(
        (first.body as { message: MessageBody }).message.id,
      );
      expect(message.body).toBe('Primeiro envio');
      expect(await countByClientId(clientId)).toBe(1);
    });

    it('dois envios simultâneos com o mesmo client_id gravam uma linha só', async () => {
      const { channel, cookie } = await memberOfNewChannel();
      const clientId = randomUUID();

      const responses = await Promise.all(
        [1, 2].map(() =>
          request(server)
            .post(`/v1/conversations/${channel.id}/messages`)
            .set('Cookie', cookie)
            .send({ client_id: clientId, body: 'Ao mesmo tempo' }),
        ),
      );

      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      const ids = responses.map(
        (response) => (response.body as { message: MessageBody }).message.id,
      );
      expect(ids[0]).toBe(ids[1]);
      expect(await countByClientId(clientId)).toBe(1);
    });

    it('recusa um client_id já usado pelo mesmo autor em outra Conversa', async () => {
      const { channel, cookie } = await memberOfNewChannel();
      const other = await conversationRoutes.createChannel(app);
      const clientId = randomUUID();
      await request(server)
        .post(`/v1/conversations/${other.id}/messages`)
        .set('Cookie', cookie)
        .send({ client_id: clientId, body: 'Na outra Conversa' });

      const response = await request(server)
        .post(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie)
        .send({ client_id: clientId, body: 'Nesta Conversa' });

      expect(response.status).toBe(400);
      expect((response.body as { code: string }).code).toBe(
        'validation_failed',
      );
    });

    it('aceita exatamente o limite em emojis', async () => {
      const { channel, cookie } = await memberOfNewChannel();

      const response = await request(server)
        .post(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie)
        .send({
          client_id: randomUUID(),
          body: '😀'.repeat(MESSAGE_MAX_LENGTH),
        });

      expect(response.status).toBe(201);
    });

    it('recusa um caractere acima do limite', async () => {
      const { channel, cookie } = await memberOfNewChannel();

      const response = await request(server)
        .post(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie)
        .send({
          client_id: randomUUID(),
          body: '😀'.repeat(MESSAGE_MAX_LENGTH + 1),
        });

      expect(response.status).toBe(400);
      expect((response.body as { code: string }).code).toBe(
        'validation_failed',
      );
    });

    it('responde 404 ao enviar numa Conversa sem participação', async () => {
      const { person, channel, cookie } = await memberOfNewChannel();
      await conversationRoutes.removeMembership(app, channel.id, person.id);

      const response = await request(server)
        .post(`/v1/conversations/${channel.id}/messages`)
        .set('Cookie', cookie)
        .send({ client_id: randomUUID(), body: 'Olá' });

      expect(response.status).toBe(404);
    });

    it('responde 401 sem Sessão', async () => {
      const response = await request(server)
        .post(`/v1/conversations/${randomUUID()}/messages`)
        .send({ client_id: randomUUID(), body: 'Olá' });

      expect(response.status).toBe(401);
    });
  });
});
