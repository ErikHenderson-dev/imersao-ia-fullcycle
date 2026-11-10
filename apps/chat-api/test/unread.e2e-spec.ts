import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type ListedConversation = {
  id: string;
  last_read_message_id: string | null;
  unread_count: number;
  mention_count: number;
};

// Não lidas e Menções na lista de Conversas (spec da F07, "Última leitura e contagem").
describe('Não lidas e Menções', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function listed(
    cookie: string,
    conversationId: string,
  ): Promise<ListedConversation> {
    return conversationRoutes.listed<ListedConversation>(
      app,
      cookie,
      conversationId,
    );
  }

  function numbers(conversation: ListedConversation) {
    return {
      unread: conversation.unread_count,
      mentions: conversation.mention_count,
    };
  }

  function send(cookie: string, conversationId: string, body: string) {
    return conversationRoutes.sentId(app, cookie, conversationId, body);
  }

  // Um Canal privado com a Pessoa que lê e uma autora que escreve.
  async function channelWithReader() {
    const author = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const reader = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [reader.person.id])
      .expect(200);
    return { author, reader, channelId };
  }

  it('conta as Não lidas de outros depois da Última leitura', async () => {
    const { author, reader, channelId } = await channelWithReader();
    await send(author.cookie, channelId, 'Uma');
    const second = await send(author.cookie, channelId, 'Duas');

    expect(await listed(reader.cookie, channelId)).toMatchObject({
      unread_count: 2,
      mention_count: 0,
    });
    // As próprias Mensagens não contam para a autora.
    expect(await listed(author.cookie, channelId)).toMatchObject({
      last_read_message_id: second,
      unread_count: 0,
      mention_count: 0,
    });
  });

  it('a Menção conta uma vez por Mensagem', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const username = reader.person.username;
    await send(author.cookie, channelId, `@${username} e @${username}`);
    await send(author.cookie, channelId, `De novo, @${username}`);
    await send(author.cookie, channelId, 'Sem Menção');

    expect(numbers(await listed(reader.cookie, channelId))).toEqual({
      unread: 3,
      mentions: 2,
    });
  });

  it('a própria Menção e a Conversa consigo mesma não contam', async () => {
    const { author, channelId } = await channelWithReader();
    await send(author.cookie, channelId, `Eu: @${author.person.username}`);
    const selfId = await conversationRoutes.directOf(
      app,
      author.cookie,
      author.person.id,
    );
    await send(author.cookie, selfId, `Nota: @${author.person.username}`);

    expect(numbers(await listed(author.cookie, channelId))).toEqual({
      unread: 0,
      mentions: 0,
    });
    expect(numbers(await listed(author.cookie, selfId))).toEqual({
      unread: 0,
      mentions: 0,
    });
  });

  it('a Menção acrescentada na edição de uma Não lida passa a contar', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const plain = await send(author.cookie, channelId, 'Sem Menção');

    await conversationRoutes
      .editMessage(
        app,
        author.cookie,
        channelId,
        plain,
        `Agora @${reader.person.username}`,
      )
      .expect(200);

    expect(numbers(await listed(reader.cookie, channelId))).toEqual({
      unread: 1,
      mentions: 1,
    });
  });

  it('a Menção tirada na edição de uma Não lida deixa de contar', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const mentioning = await send(
      author.cookie,
      channelId,
      `@${reader.person.username}`,
    );

    await conversationRoutes
      .editMessage(app, author.cookie, channelId, mentioning, 'Sem Menção')
      .expect(200);

    expect(numbers(await listed(reader.cookie, channelId))).toEqual({
      unread: 1,
      mentions: 0,
    });
  });

  it('apagar uma Não lida a tira das duas contagens', async () => {
    const { author, reader, channelId } = await channelWithReader();
    await send(author.cookie, channelId, 'Fica');
    const mentioning = await send(
      author.cookie,
      channelId,
      `@${reader.person.username}`,
    );

    await conversationRoutes
      .deleteMessage(app, author.cookie, channelId, mentioning)
      .expect(204);

    expect(numbers(await listed(reader.cookie, channelId))).toEqual({
      unread: 1,
      mentions: 0,
    });
  });

  it('as contagens param em 100', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const ids = await conversationRoutes.insertMessages(app, {
      conversationId: channelId,
      authorId: author.person.id,
      count: 101,
      startAt: new Date(Date.now() + 60_000),
    });
    await app.get(DataSource).query(
      `INSERT INTO message_mentions (id, message_id, person_id)
       SELECT gen_random_uuid(), message_id, $2 FROM unnest($1::uuid[]) AS message_id`,
      [ids, reader.person.id],
    );

    expect(numbers(await listed(reader.cookie, channelId))).toEqual({
      unread: 100,
      mentions: 100,
    });
  });

  it('enviar avança a Última leitura do autor', async () => {
    const { author, reader, channelId } = await channelWithReader();
    await send(author.cookie, channelId, 'Uma');
    await send(author.cookie, channelId, 'Duas');

    const own = await send(reader.cookie, channelId, 'Li tudo');

    expect(await listed(reader.cookie, channelId)).toMatchObject({
      last_read_message_id: own,
      unread_count: 0,
    });
  });

  it('o reenvio não muda a Última leitura', async () => {
    const { author, reader, channelId } = await channelWithReader();
    const response = await conversationRoutes
      .sendMessage(app, reader.cookie, channelId, { body: 'Primeira' })
      .expect(201);
    const { id: own, client_id: clientId } = (
      response.body as { message: { id: string; client_id: string } }
    ).message;
    await send(author.cookie, channelId, 'Depois');

    await conversationRoutes
      .sendMessage(app, reader.cookie, channelId, {
        body: 'Primeira',
        clientId,
      })
      .expect(201);

    expect(await listed(reader.cookie, channelId)).toMatchObject({
      last_read_message_id: own,
      unread_count: 1,
    });
  });

  it('quem é adicionado a um Canal privado começa sem Não lidas', async () => {
    const author = await authRoutes.loggedIn(app);
    const late = await authRoutes.loggedIn(app);
    const channelId = await conversationRoutes.privateChannelOf(
      app,
      author.cookie,
    );
    await send(author.cookie, channelId, 'Antes');
    const last = await send(author.cookie, channelId, 'Antes também');

    await conversationRoutes
      .addMembers(app, author.cookie, channelId, [late.person.id])
      .expect(200);

    expect(await listed(late.cookie, channelId)).toMatchObject({
      last_read_message_id: last,
      unread_count: 0,
    });
  });

  it('a conta nova começa sem Não lidas nos Canais públicos', async () => {
    const author = await authRoutes.loggedIn(app);
    const channel = await conversationRoutes.createChannel(app);
    const last = await send(author.cookie, channel.id, 'Antes da conta nova');

    const newcomer = await authRoutes.loggedInInPublicChannels(app);

    expect(await listed(newcomer.cookie, channel.id)).toMatchObject({
      last_read_message_id: last,
      unread_count: 0,
    });
  });

  it('a primeira Mensagem da Conversa direta é Não lida para a outra Pessoa', async () => {
    const opener = await authRoutes.loggedIn(app);
    const other = await authRoutes.loggedIn(app);
    const directId = await conversationRoutes.directOf(
      app,
      opener.cookie,
      other.person.id,
    );

    await send(opener.cookie, directId, 'Oi');
    await send(opener.cookie, directId, 'Tudo bem?');

    expect(await listed(other.cookie, directId)).toMatchObject({
      last_read_message_id: null,
      unread_count: 2,
      mention_count: 0,
    });
  });

  it('responde 401 sem Sessão', async () => {
    await request(server).get('/v1/conversations').expect(401);
  });
});
