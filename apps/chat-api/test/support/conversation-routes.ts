import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { Bot } from '../../src/bots/bot.entity';
import { BotsService } from '../../src/bots/bots.service';
import { ConversationsService } from '../../src/conversations/conversations.service';
import { Conversation } from '../../src/conversations/conversation.entity';
import { uniqueChannelName } from './unique-channel-name';
import { uuidV7At } from './uuid-v7-at';

// Atalhos da base de testes para Canais e Mensagens, no Arrange, sem asserção.
export const conversationRoutes = {
  // Pelo service, como o comando de canais: todas as Pessoas do banco viram Membros.
  createChannel(
    app: INestApplication,
    options: { name?: string; topic?: string } = {},
  ): Promise<Conversation> {
    return app
      .get(ConversationsService)
      .createPublicChannel(options.name ?? uniqueChannelName(), options.topic);
  },

  // Pelo REST, como a web: o Canal é criado e publicado.
  createChannelByRest(
    app: INestApplication,
    cookie: string,
    body: {
      kind?: string;
      name?: string;
      topic?: string;
      clientId?: string;
    } = {},
  ): request.Test {
    return request(app.getHttpServer() as App)
      .post('/v1/conversations')
      .set('Cookie', cookie)
      .send({
        kind: body.kind ?? 'public_channel',
        name: body.name ?? uniqueChannelName(),
        topic: body.topic,
        client_id: body.clientId ?? randomUUID(),
      });
  },

  // Pelo REST, como a web: abre a Conversa direta com a Pessoa (F05). Aceita qualquer corpo extra,
  // para os testes da validação.
  openDirect(
    app: INestApplication,
    cookie: string,
    personId: string,
    extra: Record<string, unknown> = {},
  ): request.Test {
    return request(app.getHttpServer() as App)
      .post('/v1/conversations')
      .set('Cookie', cookie)
      .send({ kind: 'direct', person_id: personId, ...extra });
  },

  // Pelo REST, como a web: a Conversa como aparece na lista de quem tem o cookie (F07).
  async listed<T extends { id: string }>(
    app: INestApplication,
    cookie: string,
    conversationId: string,
  ): Promise<T> {
    const response = await request(app.getHttpServer() as App)
      .get('/v1/conversations')
      .set('Cookie', cookie)
      .expect(200);
    const found = (response.body as { conversations: T[] }).conversations.find(
      (conversation) => conversation.id === conversationId,
    );
    if (!found) throw new Error('A Conversa não está na lista.');
    return found;
  },

  // Pelo REST, como a web: abre a Conversa direta com a Pessoa. Devolve o id.
  async directOf(
    app: INestApplication,
    cookie: string,
    personId: string,
  ): Promise<string> {
    const response = await conversationRoutes
      .openDirect(app, cookie, personId)
      .expect(201);
    return (response.body as { conversation: { id: string } }).conversation.id;
  },

  // Pelo REST: um Canal privado só de quem o cria. Devolve o id.
  async privateChannelOf(
    app: INestApplication,
    cookie: string,
  ): Promise<string> {
    const response = await conversationRoutes.createChannelByRest(app, cookie, {
      kind: 'private_channel',
    });
    return (response.body as { conversation: { id: string } }).conversation.id;
  },

  // Pelo REST, como a web: as Pessoas viram Membros do Canal privado. Aceita qualquer corpo, para
  // os testes da validação.
  addMembers(
    app: INestApplication,
    cookie: string,
    conversationId: string,
    personIds: unknown,
  ): request.Test {
    return request(app.getHttpServer() as App)
      .post(`/v1/conversations/${conversationId}/members`)
      .set('Cookie', cookie)
      .send({ person_ids: personIds });
  },

  // Pelo REST, como a web: a Mensagem é gravada e publicada.
  sendMessage(
    app: INestApplication,
    cookie: string,
    conversationId: string,
    options: { clientId?: string; body?: string } = {},
  ): request.Test {
    return request(app.getHttpServer() as App)
      .post(`/v1/conversations/${conversationId}/messages`)
      .set('Cookie', cookie)
      .send({
        client_id: options.clientId ?? randomUUID(),
        body: options.body ?? 'Chegou na hora',
      });
  },

  // Pelo REST, como a web: envia e devolve o id da Mensagem gravada.
  async sentId(
    app: INestApplication,
    cookie: string,
    conversationId: string,
    body: string,
  ): Promise<string> {
    const response = await conversationRoutes
      .sendMessage(app, cookie, conversationId, { body })
      .expect(201);
    return (response.body as { message: { id: string } }).message.id;
  },

  // Pelo REST, como a web: edita a Mensagem (spec da F06, "Rotas"). Aceita qualquer corpo, para os
  // testes da validação.
  editMessage(
    app: INestApplication,
    cookie: string,
    conversationId: string,
    messageId: string,
    body: unknown,
  ): request.Test {
    return request(app.getHttpServer() as App)
      .patch(`/v1/conversations/${conversationId}/messages/${messageId}`)
      .set('Cookie', cookie)
      .send({ body });
  },

  // Pelo REST, como a web: apaga a Mensagem (spec da F06, "Rotas").
  deleteMessage(
    app: INestApplication,
    cookie: string,
    conversationId: string,
    messageId: string,
  ): request.Test {
    return request(app.getHttpServer() as App)
      .delete(`/v1/conversations/${conversationId}/messages/${messageId}`)
      .set('Cookie', cookie);
  },

  async removeMembership(
    app: INestApplication,
    conversationId: string,
    personId: string,
  ): Promise<void> {
    await app
      .get(DataSource)
      .query(
        'DELETE FROM conversation_members WHERE conversation_id = $1 AND person_id = $2',
        [conversationId, personId],
      );
  },

  // Direto no banco, com o id UUID v7 no instante de cada Mensagem: a primeira em `startAt` e as
  // seguintes a cada `stepMs`, numa inserção só. Devolve os ids na ordem cronológica.
  async insertMessages(
    app: INestApplication,
    options: {
      conversationId: string;
      authorId: string;
      count: number;
      startAt?: Date;
      stepMs?: number;
    },
  ): Promise<string[]> {
    const start = (
      options.startAt ?? new Date(Date.now() - 86_400_000)
    ).getTime();
    const step = options.stepMs ?? 1000;
    const instants = Array.from(
      { length: options.count },
      (_, index) => start + index * step,
    );
    const ids = instants.map((at) => uuidV7At(at));
    await app.get(DataSource).query(
      `INSERT INTO messages (id, conversation_id, author_person_id, client_id, body, created_at, updated_at)
       SELECT id, $1, $2, gen_random_uuid(), 'Mensagem ' || position, at, at
       FROM unnest($3::uuid[], $4::timestamptz[]) WITH ORDINALITY AS rows(id, at, position)`,
      [
        options.conversationId,
        options.authorId,
        ids,
        instants.map((at) => new Date(at)),
      ],
    );
    return ids;
  },

  // Um bot de Agente, pelo service, como o comando de contas (spec da F10, "Bots"), com @usuário
  // aleatório: os testes não dependem do bot `assistente`.
  createBot(app: INestApplication, name = 'Assistente'): Promise<Bot> {
    return app.get(BotsService).create({
      username: `bot-${randomUUID().replaceAll('-', '').slice(0, 20)}`,
      name,
    });
  },

  // Direto no banco, como a Mensagem de bot que a ação `reply` da F11 vai gravar: sem evento nem
  // Última leitura. Devolve o id.
  async insertBotMessage(
    app: INestApplication,
    options: { conversationId: string; botId: string; body?: string },
  ): Promise<string> {
    const id = uuidV7At(Date.now());
    await app.get(DataSource).query(
      `INSERT INTO messages (id, conversation_id, author_bot_id, client_id, body)
         VALUES ($1, $2, $3, gen_random_uuid(), $4)`,
      [
        id,
        options.conversationId,
        options.botId,
        options.body ?? 'Resumo de hoje',
      ],
    );
    return id;
  },
};
