import { INestApplication } from '@nestjs/common';
import { authRoutes } from './support/auth-routes';
import { botRoutes } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type CountsBody = { counts: { since: string; count: number }[]; total: number };

type QuestionMessage = {
  id: string;
  author: { kind: string };
  body: string;
  quick_replies: {
    options: string[];
    owner_id: string;
    expires_at: string;
    closed: boolean;
  } | null;
};

const LABELS = ['Hoje (3)', 'Desde ontem (5)', 'A semana (12)', 'Tudo (24)'];

// As contagens dos Recortes e a pergunta do bot (spec da F11, "Rotas do bot e credencial"; F11-T07,
// CA2).
describe('Contagens e pergunta do bot', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function openRequest() {
    const member = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const other = await authRoutes.createPerson(app, { name: 'Bruno Lima' });
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const requestId = await botRoutes.openedRequestId(
      app,
      member.cookie,
      channel.id,
      bot.username,
    );
    return { member, other: other.person, channel, bot, requestId };
  }

  function at(base: Date, hours: number): string {
    return new Date(base.getTime() + hours * 3_600_000).toISOString();
  }

  it('conta as Mensagens desde cada since, como a leitura', async () => {
    const { member, other, channel, bot, requestId } = await openRequest();
    const base = new Date(Date.now() - 10 * 3_600_000);
    const anaIds = await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: member.person.id,
      count: 4,
      startAt: new Date(at(base, 0)),
      stepMs: 3_600_000,
    });
    await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: other.id,
      count: 2,
      startAt: new Date(at(base, 1.5)),
      stepMs: 3_600_000,
    });
    await botRoutes.softDeleteMessage(app, anaIds[3]);
    await conversationRoutes.insertBotMessage(app, {
      conversationId: channel.id,
      botId: bot.id,
    });
    const since = [at(base, 1), at(base, 2), at(base, -1)];
    const until = at(base, 5);
    const read = await Promise.all(
      [...since, undefined].map(async (start) => {
        const response = await botRoutes
          .readMessages(
            app,
            requestId,
            start ? { since: start, until } : { until },
          )
          .expect(200);
        return (response.body as { total: number }).total;
      }),
    );

    const response = await botRoutes.messageCounts(app, requestId, {
      since,
      until,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      counts: [
        { since: since[0], count: 4 },
        { since: since[1], count: 2 },
        { since: since[2], count: 5 },
      ],
      total: 5,
    });
    expect(read).toEqual([4, 2, 5, 5]);
  });

  it('sem since, devolve só o total', async () => {
    const { member, channel, requestId } = await openRequest();
    await conversationRoutes.insertMessages(app, {
      conversationId: channel.id,
      authorId: member.person.id,
      count: 2,
    });

    const response = await botRoutes.messageCounts(app, requestId);

    expect(response.status).toBe(200);
    // As duas inseridas e a própria Mensagem do Pedido, sem `until`.
    expect(response.body as CountsBody).toEqual({ counts: [], total: 3 });
  });

  it('responde 400 com since inválido', async () => {
    const { requestId } = await openRequest();

    const response = await botRoutes.messageCounts(app, requestId, {
      since: ['2026-11-10T10:00:00'],
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('responde 401 sem a credencial', async () => {
    const { requestId } = await openRequest();

    const response = await botRoutes.messageCounts(app, requestId, {}, null);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'invalid_bot_token' });
  });

  it('grava a pergunta e abre a Pergunta pendente de quem pediu', async () => {
    const { member, channel, bot, requestId } = await openRequest();
    const before = Date.now();

    const response = await botRoutes.question(app, requestId, {
      body: 'De que período você quer o resumo?',
      quick_replies: LABELS,
    });

    expect(response.status).toBe(201);
    const message = (response.body as { message: QuestionMessage }).message;
    expect(message).toMatchObject({
      author: { kind: 'bot' },
      body: 'De que período você quer o resumo?',
      quick_replies: {
        options: LABELS,
        owner_id: member.person.id,
        closed: false,
      },
    });
    const expiresAt = new Date(message.quick_replies!.expires_at).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 3_600_000 - 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 3_600_000 + 1000);
    const rows = await botRoutes.pendingQuestionRows(app, channel.id);
    expect(rows).toEqual([
      expect.objectContaining({
        request_id: requestId,
        person_id: member.person.id,
        bot_id: bot.id,
        question_message_id: message.id,
        closed_at: null,
      }),
    ]);
  });

  it('repetir devolve a mesma pergunta', async () => {
    const { channel, requestId } = await openRequest();
    const first = await botRoutes.question(app, requestId).expect(201);

    const response = await botRoutes.question(app, requestId, {
      body: 'Outra pergunta',
      quick_replies: ['Hoje (9)'],
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(first.body);
    expect(await botRoutes.pendingQuestionRows(app, channel.id)).toHaveLength(
      1,
    );
    expect(
      await botRoutes.countMessages(app, channel.id, { botOnly: true }),
    ).toBe(1);
  });

  it('a pergunta nova encerra a anterior', async () => {
    const { member, channel, bot, requestId } = await openRequest();
    const previous = await botRoutes.question(app, requestId).expect(201);
    // Um segundo Pedido da mesma Pessoa, direto no banco: pelo envio, a Menção já encerraria a
    // pergunta aberta.
    const second = await botRoutes.insertRequest(app, {
      conversationId: channel.id,
      requesterId: member.person.id,
      botId: bot.id,
    });

    const response = await botRoutes.question(app, second);

    expect(response.status).toBe(201);
    const rows = await botRoutes.pendingQuestionRows(app, channel.id);
    const previousId = (previous.body as { message: { id: string } }).message
      .id;
    expect(rows.map((row) => [row.request_id, row.closed_at === null])).toEqual(
      [
        [requestId, false],
        [second, true],
      ],
    );
    expect(rows[0].question_message_id).toBe(previousId);
  });

  it('duas perguntas ao mesmo tempo para a mesma Pessoa deixam uma aberta', async () => {
    const { member, channel, bot, requestId } = await openRequest();
    const second = await botRoutes.insertRequest(app, {
      conversationId: channel.id,
      requesterId: member.person.id,
      botId: bot.id,
    });

    const responses = await Promise.all(
      [requestId, second].map((id) => botRoutes.question(app, id)),
    );

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const rows = await botRoutes.pendingQuestionRows(app, channel.id);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.closed_at === null)).toHaveLength(1);
  });

  it.each([
    ['sem quick_replies', { body: 'Qual período?' }],
    [
      'com mais de quatro rótulos',
      { body: 'Qual período?', quick_replies: ['a', 'b', 'c', 'd', 'e'] },
    ],
    ['com um rótulo vazio', { body: 'Qual período?', quick_replies: ['  '] }],
    [
      'com rótulos repetidos',
      { body: 'Qual período?', quick_replies: ['Hoje (1)', ' Hoje (1)'] },
    ],
  ])('responde 400 com quick_replies inválidas (%s)', async (_, payload) => {
    const { requestId } = await openRequest();

    const response = await botRoutes.question(app, requestId, payload);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  // A pergunta sem botões da delegação incompleta (spec da F12, "O Agente `assistente`").
  it('aceita a pergunta sem Respostas prontas e abre a Pergunta pendente', async () => {
    const { channel, requestId } = await openRequest();

    const response = await botRoutes.question(app, requestId, {
      body: 'A quem eu delego?',
      quick_replies: [],
    });

    expect(response.status).toBe(201);
    expect(
      (response.body as { message: QuestionMessage }).message.quick_replies,
    ).toMatchObject({ options: [], closed: false });
    expect(await botRoutes.pendingQuestionRows(app, channel.id)).toHaveLength(
      1,
    );
  });
});
