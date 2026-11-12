import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { conversationRoutes } from './conversation-routes';

// A credencial de bot dos testes, fixada em test/support/test-env.ts.
export const TEST_BOT_TOKEN = process.env.CHAT_BOT_TOKEN!;

export interface AgentRequestRow {
  id: string;
  conversation_id: string;
  requester_id: string;
  bot_id: string;
  trigger_message_id: string;
  kind: string;
  parent_request_id: string | null;
  status: string;
  expires_at: Date;
  created_at: Date;
}

export interface TaskRow {
  id: string;
  request_id: string;
  conversation_id: string;
  trigger_message_id: string;
  assignee_id: string;
  delegator_id: string;
  title: string;
  status: string;
  completed_at: Date | null;
}

export interface PendingQuestionRow {
  id: string;
  request_id: string;
  conversation_id: string;
  person_id: string;
  bot_id: string;
  question_message_id: string;
  expires_at: Date;
  closed_at: Date | null;
  created_at: Date;
}

// Atalhos da base de testes para o Pedido e as rotas do bot (spec da F11), no Arrange, sem asserção.
export const botRoutes = {
  // Pelo REST, como o BFF: a Mensagem com o `agent_username` do Agente mencionado.
  sendMention(
    app: INestApplication,
    cookie: string,
    conversationId: string,
    agentUsername: string,
    options: { clientId?: string; body?: string } = {},
  ): request.Test {
    return conversationRoutes.sendMessage(app, cookie, conversationId, {
      clientId: options.clientId,
      body: options.body ?? `@${agentUsername} resume hoje`,
      agentUsername,
    });
  },

  // Envia a Menção e devolve o id do Pedido que ela criou.
  async openedRequestId(
    app: INestApplication,
    cookie: string,
    conversationId: string,
    agentUsername: string,
  ): Promise<string> {
    const response = await botRoutes
      .sendMention(app, cookie, conversationId, agentUsername)
      .expect(201);
    return (response.body as { agent_request: { id: string } }).agent_request
      .id;
  },

  // A resposta do bot ao Pedido, com a credencial de bot, ou com a que o teste passar.
  // Os campos extras vão no corpo, como a marca `business_data` (spec da F13).
  reply(
    app: INestApplication,
    requestId: string,
    body: unknown,
    token: string | null = TEST_BOT_TOKEN,
    extra: Record<string, unknown> = {},
  ): request.Test {
    const call = request(app.getHttpServer() as App)
      .post(`/v1/bot/requests/${requestId}/reply`)
      .send({ body, ...extra });
    return token === null ? call : call.set('Authorization', `Bearer ${token}`);
  },

  // O "digitando" do bot no Pedido, com a credencial de bot, ou com a que o teste passar.
  typing(
    app: INestApplication,
    requestId: string,
    token: string | null = TEST_BOT_TOKEN,
  ): request.Test {
    const call = request(app.getHttpServer() as App).post(
      `/v1/bot/requests/${requestId}/typing`,
    );
    return token === null ? call : call.set('Authorization', `Bearer ${token}`);
  },

  // As ações de bot gravadas no Pedido.
  async countActions(
    app: INestApplication,
    requestId: string,
  ): Promise<number> {
    const [row] = await app
      .get(DataSource)
      .query<{ count: string }[]>(
        'SELECT count(*) FROM bot_actions WHERE request_id = $1',
        [requestId],
      );
    return Number(row.count);
  },

  // A leitura do Recorte pelo bot, com a credencial de bot, ou com a que o teste passar.
  readMessages(
    app: INestApplication,
    requestId: string,
    query: Record<string, string> = {},
    token: string | null = TEST_BOT_TOKEN,
  ): request.Test {
    const call = request(app.getHttpServer() as App)
      .get(`/v1/bot/requests/${requestId}/messages`)
      .query(query);
    return token === null ? call : call.set('Authorization', `Bearer ${token}`);
  },

  // As contagens dos Recortes pelo bot: `since` repetido na query, na ordem dada.
  messageCounts(
    app: INestApplication,
    requestId: string,
    { since = [], until }: { since?: string[]; until?: string } = {},
    token: string | null = TEST_BOT_TOKEN,
  ): request.Test {
    const query = [
      ...since.map((value) => `since=${encodeURIComponent(value)}`),
      ...(until ? [`until=${encodeURIComponent(until)}`] : []),
    ].join('&');
    const call = request(app.getHttpServer() as App).get(
      `/v1/bot/requests/${requestId}/message-counts${query ? `?${query}` : ''}`,
    );
    return token === null ? call : call.set('Authorization', `Bearer ${token}`);
  },

  // A delegação pelo bot (spec da F12, "Ação `task`"), com a credencial de bot, ou com a que o
  // teste passar.
  task(
    app: INestApplication,
    requestId: string,
    payload: unknown,
    token: string | null = TEST_BOT_TOKEN,
  ): request.Test {
    const call = request(app.getHttpServer() as App)
      .post(`/v1/bot/requests/${requestId}/task`)
      .send(payload as object);
    return token === null ? call : call.set('Authorization', `Bearer ${token}`);
  },

  // As Tarefas da Conversa, direto no banco.
  async taskRows(
    app: INestApplication,
    conversationId: string,
  ): Promise<TaskRow[]> {
    return app
      .get(DataSource)
      .query<TaskRow[]>(
        'SELECT * FROM tasks WHERE conversation_id = $1 ORDER BY id',
        [conversationId],
      );
  },

  // A ação gravada no Pedido, com o tipo dela.
  async actionRows(
    app: INestApplication,
    requestId: string,
  ): Promise<{ action_type: string; message_id: string }[]> {
    return app
      .get(DataSource)
      .query<{ action_type: string; message_id: string }[]>(
        'SELECT action_type, message_id FROM bot_actions WHERE request_id = $1',
        [requestId],
      );
  },

  // A pergunta do bot com as Respostas prontas, com a credencial de bot.
  question(
    app: INestApplication,
    requestId: string,
    payload: unknown = {
      body: 'De que período você quer o resumo?',
      quick_replies: [
        'Hoje (1)',
        'Desde ontem (1)',
        'A semana (1)',
        'Tudo (1)',
      ],
    },
  ): request.Test {
    return request(app.getHttpServer() as App)
      .post(`/v1/bot/requests/${requestId}/question`)
      .set('Authorization', `Bearer ${TEST_BOT_TOKEN}`)
      .send(payload as object);
  },

  // Envia a Menção e grava a pergunta do bot no Pedido: a Pergunta pendente aberta de quem enviou.
  async openQuestion(
    app: INestApplication,
    cookie: string,
    conversationId: string,
    agentUsername: string,
  ): Promise<{ requestId: string; questionId: string }> {
    const requestId = await botRoutes.openedRequestId(
      app,
      cookie,
      conversationId,
      agentUsername,
    );
    const response = await botRoutes.question(app, requestId).expect(201);
    return {
      requestId,
      questionId: (response.body as { message: { id: string } }).message.id,
    };
  },

  // Direto no banco: um Pedido `new` aberto de quem pediu, com uma Mensagem dele, sem passar pelo
  // envio. Devolve o id do Pedido.
  async insertRequest(
    app: INestApplication,
    options: { conversationId: string; requesterId: string; botId: string },
  ): Promise<string> {
    const [messageId] = await conversationRoutes.insertMessages(app, {
      conversationId: options.conversationId,
      authorId: options.requesterId,
      count: 1,
      startAt: new Date(),
    });
    const [row] = await app.get(DataSource).query<{ id: string }[]>(
      `INSERT INTO agent_requests (id, conversation_id, requester_id, bot_id, trigger_message_id, kind, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'new', now() + interval '2 minutes') RETURNING id`,
      [options.conversationId, options.requesterId, options.botId, messageId],
    );
    return row.id;
  },

  // As Perguntas pendentes da Conversa, da mais antiga para a mais nova.
  async pendingQuestionRows(
    app: INestApplication,
    conversationId: string,
  ): Promise<PendingQuestionRow[]> {
    return app
      .get(DataSource)
      .query<PendingQuestionRow[]>(
        'SELECT * FROM pending_questions WHERE conversation_id = $1 ORDER BY id',
        [conversationId],
      );
  },

  // Direto no banco: vence a pergunta da Mensagem.
  async expireQuestion(
    app: INestApplication,
    questionMessageId: string,
  ): Promise<void> {
    await app
      .get(DataSource)
      .query(
        "UPDATE pending_questions SET expires_at = now() - interval '1 second' WHERE question_message_id = $1",
        [questionMessageId],
      );
  },

  // Direto no banco: apaga a Mensagem como a exclusão da F06 (sem texto e com `deleted_at`).
  async softDeleteMessage(app: INestApplication, id: string): Promise<void> {
    await app
      .get(DataSource)
      .query(
        'UPDATE messages SET deleted_at = now(), body = NULL WHERE id = $1',
        [id],
      );
  },

  // O encerramento do Pedido pelo BFF, com a Sessão de quem chama, ou sem Sessão.
  closeRequest(
    app: INestApplication,
    cookie: string | null,
    requestId: string,
    status: unknown,
  ): request.Test {
    const call = request(app.getHttpServer() as App)
      .post(`/v1/agent-requests/${requestId}/close`)
      .send({ status });
    return cookie === null ? call : call.set('Cookie', cookie);
  },

  async requestStatus(
    app: INestApplication,
    requestId: string,
  ): Promise<string> {
    const [row] = await app
      .get(DataSource)
      .query<{ status: string }[]>(
        'SELECT status FROM agent_requests WHERE id = $1',
        [requestId],
      );
    return row.status;
  },

  async requestRows(
    app: INestApplication,
    conversationId: string,
  ): Promise<AgentRequestRow[]> {
    return app
      .get(DataSource)
      .query<AgentRequestRow[]>(
        'SELECT * FROM agent_requests WHERE conversation_id = $1',
        [conversationId],
      );
  },

  // Direto no banco: envelhece ou encerra o Pedido.
  async updateRequest(
    app: INestApplication,
    requestId: string,
    changes: { expiresAt?: Date; status?: string },
  ): Promise<void> {
    await app
      .get(DataSource)
      .query(
        'UPDATE agent_requests SET expires_at = COALESCE($2, expires_at), status = COALESCE($3, status) WHERE id = $1',
        [requestId, changes.expiresAt ?? null, changes.status ?? null],
      );
  },

  // As Mensagens da Conversa, todas ou só as de bot.
  async countMessages(
    app: INestApplication,
    conversationId: string,
    { botOnly = false }: { botOnly?: boolean } = {},
  ): Promise<number> {
    const [row] = await app
      .get(DataSource)
      .query<{ count: string }[]>(
        `SELECT count(*) FROM messages WHERE conversation_id = $1${botOnly ? ' AND author_bot_id IS NOT NULL' : ''}`,
        [conversationId],
      );
    return Number(row.count);
  },
};
