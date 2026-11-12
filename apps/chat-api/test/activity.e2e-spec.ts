import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type ActivityItem = {
  kind: 'mention' | 'direct';
  message: { id: string; body: string; conversation_id: string };
  conversation: { id: string; kind: string; name: string | null };
};

type ActivityPage = { items: ActivityItem[]; has_more: boolean };

type ActivityUnread = {
  activity_read_message_id?: string | null;
  total_count: number;
  mention_count: number;
  direct_count: number;
};

// A Atividade da Pessoa: as Notificações calculadas e os números (spec da F08, "Notificações e
// contagem" e "Rotas"; ADR 0027).
describe('Atividade', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function activity(cookie: string, query: Record<string, string> = {}) {
    return request(server)
      .get('/v1/activity')
      .query(query)
      .set('Cookie', cookie);
  }

  async function page(
    cookie: string,
    query: Record<string, string> = {},
  ): Promise<ActivityPage> {
    const response = await activity(cookie, query).expect(200);
    return response.body as ActivityPage;
  }

  async function unread(cookie: string): Promise<ActivityUnread> {
    const response = await request(server)
      .get('/v1/activity/unread')
      .set('Cookie', cookie)
      .expect(200);
    // Os números, sem a marca, que os testes da marca conferem à parte.
    const body = response.body as ActivityUnread;
    return {
      total_count: body.total_count,
      mention_count: body.mention_count,
      direct_count: body.direct_count,
    };
  }

  function send(cookie: string, conversationId: string, body: string) {
    return conversationRoutes.sentId(app, cookie, conversationId, body);
  }

  function ids(result: ActivityPage): string[] {
    return result.items.map((item) => item.message.id);
  }

  // Um Canal privado com a Pessoa que recebe e uma autora que escreve, e a Conversa direta entre
  // as duas.
  async function scene() {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const reader = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [reader.person.id])
      .expect(200);
    const directId = await conversationRoutes.directOf(
      app,
      author.cookie,
      reader.person.id,
    );
    return { author, reader, channelId, directId };
  }

  it('lista as Notificações da Pessoa', async () => {
    const { author, reader, channelId, directId } = await scene();
    const mention = await send(
      author.cookie,
      channelId,
      `Oi, @${reader.person.username}`,
    );
    const direct = await send(author.cookie, directId, 'Tudo bem?');

    const result = await page(reader.cookie);

    expect(result.has_more).toBe(false);
    expect(result.items).toEqual([
      expect.objectContaining({
        kind: 'mention',
        message: expect.objectContaining({
          id: mention,
          body: `Oi, @${reader.person.username}`,
        }) as unknown,
        conversation: expect.objectContaining({
          id: channelId,
          kind: 'private_channel',
        }) as unknown,
      }),
      expect.objectContaining({
        kind: 'direct',
        message: expect.objectContaining({ id: direct }) as unknown,
        conversation: expect.objectContaining({
          id: directId,
          kind: 'direct',
        }) as unknown,
      }),
    ]);
  });

  it('filtra as Menções', async () => {
    const { author, reader, channelId, directId } = await scene();
    const mentionId = await send(
      author.cookie,
      channelId,
      `@${reader.person.username}`,
    );
    await send(author.cookie, directId, 'Uma');

    const result = await page(reader.cookie, { kind: 'mentions' });

    expect(ids(result)).toEqual([mentionId]);
  });

  it('filtra as Mensagens diretas', async () => {
    const { author, reader, channelId, directId } = await scene();
    await send(author.cookie, channelId, `@${reader.person.username}`);
    const first = await send(author.cookie, directId, 'Uma');
    const second = await send(author.cookie, directId, 'Duas');

    const result = await page(reader.cookie, { kind: 'direct' });

    expect(ids(result)).toEqual([first, second]);
  });

  it('a primeira página traz as mais novas e diz que há mais', async () => {
    const { author, reader, channelId, directId } = await scene();
    await send(author.cookie, channelId, `@${reader.person.username}`);
    const first = await send(author.cookie, directId, 'Uma');
    const second = await send(author.cookie, directId, 'Duas');

    const result = await page(reader.cookie, { limit: '2' });

    expect(result).toMatchObject({ has_more: true });
    expect(ids(result)).toEqual([first, second]);
  });

  it('pagina pelo id da Mensagem mais antiga recebida', async () => {
    const { author, reader, channelId, directId } = await scene();
    const mentionId = await send(
      author.cookie,
      channelId,
      `@${reader.person.username}`,
    );
    const first = await send(author.cookie, directId, 'Uma');
    await send(author.cookie, directId, 'Duas');

    const result = await page(reader.cookie, { limit: '2', before: first });

    expect(result).toMatchObject({ has_more: false });
    expect(ids(result)).toEqual([mentionId]);
  });

  it('deixa fora o que não é Notificação', async () => {
    const { author, reader, channelId, directId } = await scene();
    // As próprias Mensagens e a Menção a si mesma; quem lê abre a Conversa direta do par e vira
    // Membro dela.
    await conversationRoutes
      .openDirect(app, reader.cookie, author.person.id)
      .expect(200);
    await send(reader.cookie, channelId, `Eu: @${reader.person.username}`);
    await send(reader.cookie, directId, 'Minha');
    // A Conversa direta consigo mesma.
    const selfId = await conversationRoutes.directOf(
      app,
      reader.cookie,
      reader.person.id,
    );
    await send(reader.cookie, selfId, 'Nota');
    // A apagada.
    const deleted = await send(
      author.cookie,
      channelId,
      `@${reader.person.username} apagada`,
    );
    await conversationRoutes
      .deleteMessage(app, author.cookie, channelId, deleted)
      .expect(204);
    // A Menção dentro da Conversa direta é só uma Mensagem direta.
    const inDirect = await send(
      author.cookie,
      directId,
      `@${reader.person.username} aqui`,
    );
    // As de um Canal privado de que a Pessoa foi removida.
    const otherChannel = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    await conversationRoutes
      .addMembers(app, author.cookie, otherChannel, [reader.person.id])
      .expect(200);
    await send(author.cookie, otherChannel, `@${reader.person.username} saiu`);
    await conversationRoutes.removeMembership(
      app,
      otherChannel,
      reader.person.id,
    );

    const result = await page(reader.cookie);

    expect(result.items).toEqual([
      expect.objectContaining({
        kind: 'direct',
        message: expect.objectContaining({ id: inDirect }) as unknown,
      }),
    ]);
  });

  it('a Mensagem de bot não vira Notificação, nem na Conversa direta', async () => {
    const { author, reader, channelId, directId } = await scene();
    await conversationRoutes
      .openDirect(app, reader.cookie, author.person.id)
      .expect(200);
    const bot = await conversationRoutes.createBot(app);
    for (const conversationId of [channelId, directId]) {
      await conversationRoutes.insertBotMessage(app, {
        conversationId,
        botId: bot.id,
        body: `Resumo para @${reader.person.username}`,
      });
    }

    const [result, numbers] = await Promise.all([
      page(reader.cookie),
      unread(reader.cookie),
    ]);

    expect(result.items).toEqual([]);
    expect(numbers).toEqual({
      total_count: 0,
      mention_count: 0,
      direct_count: 0,
    });
  });

  it('a Menção acrescentada na edição cria o item', async () => {
    const { author, reader, channelId } = await scene();
    const plain = await send(author.cookie, channelId, 'Sem Menção');
    await conversationRoutes
      .editMessage(
        app,
        author.cookie,
        channelId,
        plain,
        `Agora com @${reader.person.username}`,
      )
      .expect(200);

    const result = await page(reader.cookie);

    expect(ids(result)).toEqual([plain]);
  });

  it('a Menção tirada na edição remove o item', async () => {
    const { author, reader, channelId } = await scene();
    const mentioning = await send(
      author.cookie,
      channelId,
      `Com @${reader.person.username}`,
    );
    await conversationRoutes
      .editMessage(app, author.cookie, channelId, mentioning, 'Sem Menção')
      .expect(200);

    const result = await page(reader.cookie);

    expect(ids(result)).toEqual([]);
  });

  it('responde 400 com um tipo inválido', async () => {
    const { reader } = await scene();

    const response = await activity(reader.cookie, { kind: 'tarefas' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('a lista responde 401 sem Sessão', async () => {
    const response = await request(server).get('/v1/activity');

    expect(response.status).toBe(401);
  });

  it('os números respondem 401 sem Sessão', async () => {
    const response = await request(server).get('/v1/activity/unread');

    expect(response.status).toBe(401);
  });

  it('conta as Notificações não lidas', async () => {
    const { author, reader, channelId, directId } = await scene();
    await send(author.cookie, channelId, `@${reader.person.username}`);
    await send(author.cookie, channelId, 'Sem Menção');
    await send(author.cookie, directId, 'Uma');
    await send(author.cookie, directId, 'Duas');

    expect(await unread(reader.cookie)).toEqual({
      total_count: 3,
      mention_count: 1,
      direct_count: 2,
    });
    expect(await unread(author.cookie)).toEqual({
      total_count: 0,
      mention_count: 0,
      direct_count: 0,
    });
  });

  it('ler a Conversa tira as Notificações dela dos números', async () => {
    const { author, reader, channelId, directId } = await scene();
    await send(author.cookie, channelId, `@${reader.person.username}`);
    const last = await send(author.cookie, directId, 'Uma');

    await request(server)
      .put(`/v1/conversations/${directId}/read`)
      .set('Cookie', reader.cookie)
      .send({ message_id: last })
      .expect(200);

    expect(await unread(reader.cookie)).toEqual({
      total_count: 1,
      mention_count: 1,
      direct_count: 0,
    });
  });

  it('os números param no teto', async () => {
    const { author, reader, channelId, directId } = await scene();
    // A primeira Mensagem faz de quem lê Membro da Conversa direta (ADR 0025).
    await send(author.cookie, directId, 'Oi');
    const start = new Date(Date.now() + 60_000);
    const mentioned = await conversationRoutes.insertMessages(app, {
      conversationId: channelId,
      authorId: author.person.id,
      count: 101,
      startAt: start,
    });
    await app.get(DataSource).query(
      `INSERT INTO message_mentions (id, message_id, person_id)
       SELECT gen_random_uuid(), message_id, $2 FROM unnest($1::uuid[]) AS message_id`,
      [mentioned, reader.person.id],
    );
    await conversationRoutes.insertMessages(app, {
      conversationId: directId,
      authorId: author.person.id,
      count: 101,
      startAt: start,
    });

    expect(await unread(reader.cookie)).toEqual({
      total_count: 100,
      mention_count: 100,
      direct_count: 100,
    });
  });

  function markRead(cookie: string, body: unknown) {
    return request(server)
      .put('/v1/activity/read')
      .set('Cookie', cookie)
      .send(body as object);
  }

  it('a marca tira dos números as Notificações até ela', async () => {
    const { author, reader, channelId, directId } = await scene();
    const first = await send(
      author.cookie,
      channelId,
      `@${reader.person.username}`,
    );
    await send(author.cookie, directId, 'Depois da marca');
    await app
      .get(DataSource)
      .query('UPDATE people SET activity_read_message_id = $2 WHERE id = $1', [
        reader.person.id,
        first,
      ]);

    const result = await unread(reader.cookie);

    expect(result).toEqual({
      total_count: 1,
      mention_count: 0,
      direct_count: 1,
    });
  });

  it('marcar tudo zera os números sem mexer nas Conversas', async () => {
    const { author, reader, channelId, directId } = await scene();
    await send(author.cookie, channelId, `@${reader.person.username}`);
    const newest = await send(author.cookie, directId, 'Tudo bem?');

    const response = await markRead(reader.cookie, { message_id: newest });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      activity_read_message_id: newest,
      total_count: 0,
      mention_count: 0,
      direct_count: 0,
      task_count: 0,
    });
    const listed = await conversationRoutes.listed<{
      id: string;
      last_read_message_id: string | null;
      unread_count: number;
    }>(app, reader.cookie, directId);
    expect(listed).toMatchObject({
      last_read_message_id: null,
      unread_count: 1,
    });
  });

  it('uma marca igual ou anterior não muda nada', async () => {
    const { author, reader, directId } = await scene();
    const older = await send(author.cookie, directId, 'Uma');
    const newer = await send(author.cookie, directId, 'Duas');
    await markRead(reader.cookie, { message_id: newer }).expect(200);

    const response = await markRead(reader.cookie, { message_id: older });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ activity_read_message_id: newer });
  });

  it('a Mensagem de fora responde 404', async () => {
    const { reader } = await scene();
    const outsider = await authRoutes.loggedIn(app, { name: 'Dora Reis' });
    const foreignChannel = await conversationRoutes.privateChannelOf(
      app,
      outsider.cookie,
    );
    const foreign = await send(outsider.cookie, foreignChannel, 'Só minha');

    const response = await markRead(reader.cookie, { message_id: foreign });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'message_not_found' });
  });

  it('o corpo inválido responde 400', async () => {
    const { reader } = await scene();

    const response = await markRead(reader.cookie, { message_id: 'abc' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('marcar tudo responde 401 sem Sessão', async () => {
    const response = await request(server)
      .put('/v1/activity/read')
      .send({ message_id: '01a1c666-cfbd-7307-939b-94c399a576bf' });

    expect(response.status).toBe(401);
  });
});
