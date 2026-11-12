import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { TaskResponse } from '../../src/tasks/task.response';
import { botRoutes } from './bot-routes';
import { conversationRoutes } from './conversation-routes';

// Atalhos da base de testes para as Tarefas (spec da F12), no Arrange, sem asserção.
export const taskRoutes = {
  // Pelo caminho do produto: quem delega menciona o bot no Canal, e o bot delega ao Responsável.
  async delegated(
    app: INestApplication,
    options: {
      delegatorCookie: string;
      conversationId: string;
      botUsername: string;
      assigneeUsername: string;
      title?: string;
    },
  ): Promise<TaskResponse> {
    const requestId = await botRoutes.openedRequestId(
      app,
      options.delegatorCookie,
      options.conversationId,
      options.botUsername,
    );
    const response = await botRoutes
      .task(app, requestId, {
        assignee_username: options.assigneeUsername,
        title: options.title ?? 'revisar o contrato',
      })
      .expect(201);
    return (response.body as { task: TaskResponse }).task;
  },

  list(
    app: INestApplication,
    cookie: string | null,
    query: Record<string, string>,
  ): request.Test {
    const call = request(app.getHttpServer() as App)
      .get('/v1/tasks')
      .query(query);
    return cookie === null ? call : call.set('Cookie', cookie);
  },

  get(app: INestApplication, cookie: string, taskId: string): request.Test {
    return request(app.getHttpServer() as App)
      .get(`/v1/tasks/${taskId}`)
      .set('Cookie', cookie);
  },

  change(
    app: INestApplication,
    cookie: string,
    taskId: string,
    action: 'complete' | 'reopen',
  ): request.Test {
    return request(app.getHttpServer() as App)
      .post(`/v1/tasks/${taskId}/${action}`)
      .set('Cookie', cookie);
  },

  // Uma Conversa com a Ana, o Bruno e o bot, para os testes de Tarefa.
  async channelWithBot(app: INestApplication) {
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    return { channel, bot };
  },
};
