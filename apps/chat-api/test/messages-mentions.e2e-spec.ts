import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type Mention = { id: string; username: string };
type MessageBody = { id: string; mentions: Mention[] };

describe('Menções', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  // Um Canal privado com a autora e um Membro, e uma Pessoa de fora.
  async function privateChannelWithMember() {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const member = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const outsider = await authRoutes.loggedIn(app, { name: 'Carla Dias' });
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [member.person.id])
      .expect(200);
    return { author, member, outsider, channelId };
  }

  async function send(
    cookie: string,
    channelId: string,
    body: string,
    clientId?: string,
  ) {
    const response = await conversationRoutes
      .sendMessage(app, cookie, channelId, { body, clientId })
      .expect(201);
    return (response.body as { message: MessageBody }).message;
  }

  async function storedMentions(messageId: string): Promise<string[]> {
    const rows = await app
      .get(DataSource)
      .query<{ person_id: string }[]>(
        'SELECT person_id FROM message_mentions WHERE message_id = $1 ORDER BY person_id',
        [messageId],
      );
    return rows.map((row) => row.person_id);
  }

  it('grava as Menções dos Membros no envio, sem repetir e sem diferenciar maiúsculas', async () => {
    const { author, member, channelId } = await privateChannelWithMember();
    const username = member.person.username;

    const message = await send(
      author.cookie,
      channelId,
      `Oi @${username.toUpperCase()}, e de novo @${username}. Eu mesma: @${author.person.username}`,
    );

    expect(message.mentions).toEqual(
      [
        { id: member.person.id, username },
        { id: author.person.id, username: author.person.username },
      ].sort((a, b) => a.username.localeCompare(b.username)),
    );
    expect(await storedMentions(message.id)).toEqual(
      [member.person.id, author.person.id].sort(),
    );
  });

  it('não menciona quem não é Membro, quem não existe nem o @ de um e-mail', async () => {
    const { author, member, outsider, channelId } =
      await privateChannelWithMember();

    const message = await send(
      author.cookie,
      channelId,
      `@${outsider.person.username} @ninguem-${randomUUID().slice(0, 6)} ${member.person.username}@empresa.com`,
    );

    expect(message.mentions).toEqual([]);
    expect(await storedMentions(message.id)).toEqual([]);
  });

  it('a edição grava a diferença das Menções', async () => {
    const { author, member, channelId } = await privateChannelWithMember();
    const message = await send(
      author.cookie,
      channelId,
      `Oi @${member.person.username}`,
    );

    const response = await conversationRoutes.editMessage(
      app,
      author.cookie,
      channelId,
      message.id,
      `Na verdade é comigo: @${author.person.username}`,
    );

    expect(response.status).toBe(200);
    expect(
      (response.body as { message: MessageBody }).message.mentions,
    ).toEqual([{ id: author.person.id, username: author.person.username }]);
    expect(await storedMentions(message.id)).toEqual([author.person.id]);
  });

  it('apagar mantém as Menções', async () => {
    const { author, member, channelId } = await privateChannelWithMember();
    const message = await send(
      author.cookie,
      channelId,
      `Oi @${member.person.username}`,
    );

    await conversationRoutes
      .deleteMessage(app, author.cookie, channelId, message.id)
      .expect(204);

    expect(await storedMentions(message.id)).toEqual([member.person.id]);
  });

  it('o reenvio do mesmo client_id não grava Menções a mais', async () => {
    const { author, member, channelId } = await privateChannelWithMember();
    const clientId = randomUUID();
    const first = await send(
      author.cookie,
      channelId,
      `Oi @${member.person.username}`,
      clientId,
    );

    const again = await send(
      author.cookie,
      channelId,
      `Outro texto @${author.person.username}`,
      clientId,
    );

    expect(again.id).toBe(first.id);
    expect(again.mentions).toEqual([
      { id: member.person.id, username: member.person.username },
    ]);
    expect(await storedMentions(first.id)).toEqual([member.person.id]);
  });

  it('o histórico traz mentions', async () => {
    const { author, member, channelId } = await privateChannelWithMember();
    await send(author.cookie, channelId, `Oi @${member.person.username}`);
    await send(author.cookie, channelId, 'Sem menção');

    const response = await request(server)
      .get(`/v1/conversations/${channelId}/messages`)
      .set('Cookie', member.cookie);

    const messages = (response.body as { messages: MessageBody[] }).messages;
    expect(messages.map((message) => message.mentions)).toEqual([
      [{ id: member.person.id, username: member.person.username }],
      [],
    ]);
  });
});
