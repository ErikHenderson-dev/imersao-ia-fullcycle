import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

// A credencial de bot dos testes, fixada em test/support/test-env.ts.
export const TEST_BOT_TOKEN = 'credencial-de-bot-dos-testes';

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
    return request(app.getHttpServer() as App)
      .post(`/v1/conversations/${conversationId}/messages`)
      .set('Cookie', cookie)
      .send({
        client_id: options.clientId ?? randomUUID(),
        body: options.body ?? `@${agentUsername} resume hoje`,
        agent_username: agentUsername,
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
  reply(
    app: INestApplication,
    requestId: string,
    body: unknown,
    token: string | null = TEST_BOT_TOKEN,
  ): request.Test {
    const call = request(app.getHttpServer() as App)
      .post(`/v1/bot/requests/${requestId}/reply`)
      .send({ body });
    return token === null ? call : call.set('Authorization', `Bearer ${token}`);
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
