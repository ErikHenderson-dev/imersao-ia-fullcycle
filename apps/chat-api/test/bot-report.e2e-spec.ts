import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { PeopleService } from '../src/people/people.service';
import { authRoutes } from './support/auth-routes';
import {
  botRoutes,
  REPORT_FILE_NAME,
  REPORT_NOTICE,
  TEST_BOT_TOKEN,
  TEST_WORKER_TOKEN,
} from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';

type MessageBody = {
  id: string;
  author: { kind: string };
  body: string;
  business_data: boolean;
  blocked: boolean;
  mentions: { id: string; username: string }[];
  report: { file_name: string; size_bytes: number } | null;
};

type ActivityBody = {
  items: { kind: string; message: MessageBody }[];
};

const LONG_TTL_MS = 10 * 60 * 1000;

// O Aviso de início, a entrega e a falha do Relatório (spec da F14, "Ações de bot do Relatório";
// F14-T01, CA1 a CA4; F14-T02, CA1 e CA2).
describe('Ações de bot do Relatório', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  // A Ana pede o Relatório num Canal com o Bruno; `dataAccess` é a Permissão de dados dela.
  async function scene({ dataAccess = true } = {}) {
    const ana = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const bruno = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    if (dataAccess) {
      await app.get(PeopleService).setDataAccess(ana.person.id, true);
    }
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const requestId = await botRoutes.openedRequestId(
      app,
      ana.cookie,
      channel.id,
      bot.username,
    );
    return { ana, bruno, channel, requestId };
  }

  async function started() {
    const context = await scene();
    await botRoutes.reportStarted(app, context.requestId).expect(201);
    return context;
  }

  async function activityOf(cookie: string): Promise<ActivityBody> {
    const response = await request(server)
      .get('/v1/activity')
      .set('Cookie', cookie)
      .expect(200);
    return response.body as ActivityBody;
  }

  describe('report-started', () => {
    it('report-started grava o aviso com a marca e estende a validade do Pedido', async () => {
      const { channel, requestId } = await scene();
      const before = Date.now();

      const response = await botRoutes.reportStarted(app, requestId);

      expect(response.status).toBe(201);
      const { message } = response.body as { message: MessageBody };
      expect(message).toMatchObject({
        author: { kind: 'bot' },
        body: REPORT_NOTICE,
        business_data: true,
        blocked: false,
      });
      const [row] = await botRoutes.requestRows(app, channel.id);
      const expires = row.expires_at.getTime();
      expect(expires).toBeGreaterThanOrEqual(before + LONG_TTL_MS - 1000);
      expect(expires).toBeLessThanOrEqual(Date.now() + LONG_TTL_MS + 1000);
      expect(await botRoutes.actionRows(app, requestId)).toEqual([
        { action_type: 'report_started', message_id: message.id },
      ]);
    });

    it('uma ação depois da validade comum é aceita dentro da validade nova', async () => {
      const { requestId } = await started();
      // O Pedido nasceu há 3 min: a validade comum, de 2 min, já teria vencido.
      await app
        .get(DataSource)
        .query(
          "UPDATE agent_requests SET created_at = now() - interval '3 minutes' WHERE id = $1",
          [requestId],
        );

      const response = await botRoutes.reportFailed(app, requestId);

      expect(response.status).toBe(201);
    });

    it('report-started num Pedido respondido responde 409 request_closed', async () => {
      const { requestId } = await scene();
      await botRoutes.reply(app, requestId, 'Resumo de hoje.').expect(201);

      const response = await botRoutes.reportStarted(app, requestId);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'request_closed' });
    });

    it('report-started repetido devolve o mesmo aviso', async () => {
      const { requestId } = await scene();
      const first = await botRoutes.reportStarted(app, requestId).expect(201);

      const response = await botRoutes.reportStarted(app, requestId);

      expect(response.status).toBe(201);
      expect((response.body as { message: MessageBody }).message.id).toBe(
        (first.body as { message: MessageBody }).message.id,
      );
      expect(await botRoutes.countActions(app, requestId)).toBe(1);
    });
  });

  describe('regra de resposta do Pedido demorado', () => {
    it('report-failed sem report-started responde 409 report_not_started', async () => {
      const { requestId } = await scene();

      const response = await botRoutes.reportFailed(app, requestId);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'report_not_started' });
    });

    it('report-failed repetido devolve a mesma Mensagem', async () => {
      const { requestId } = await started();
      const first = await botRoutes.reportFailed(app, requestId).expect(201);

      const response = await botRoutes.reportFailed(app, requestId);

      expect(response.status).toBe(201);
      expect((response.body as { message: MessageBody }).message.id).toBe(
        (first.body as { message: MessageBody }).message.id,
      );
      expect(await botRoutes.countActions(app, requestId)).toBe(2);
    });

    it('reply depois do Aviso de início responde 409 request_closed', async () => {
      const { requestId } = await started();

      const response = await botRoutes.reply(app, requestId, 'Outra coisa.');

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'request_closed' });
    });

    it('report-failed depois de uma entrega responde 409 request_closed', async () => {
      const { requestId } = await started();
      const [{ message_id }] = await botRoutes.actionRows(app, requestId);
      await app
        .get(DataSource)
        .query(
          "INSERT INTO bot_actions (request_id, action_type, message_id) VALUES ($1, 'report_delivered', $2)",
          [requestId, message_id],
        );

      const response = await botRoutes.reportFailed(app, requestId);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'request_closed' });
    });

    it('o CHECK de bot_actions aceita as ações do Relatório e recusa outro tipo', async () => {
      const { requestId } = await started();
      const [{ message_id }] = await botRoutes.actionRows(app, requestId);
      const insert = (type: string) =>
        app
          .get(DataSource)
          .query(
            'INSERT INTO bot_actions (request_id, action_type, message_id) VALUES ($1, $2, $3)',
            [requestId, type, message_id],
          );
      await insert('report_delivered');
      await insert('report_failed');

      const rejected = insert('report_cancelled');

      await expect(rejected).rejects.toThrow(/bot_actions_action_type_check/);
    });
  });

  describe('report-failed', () => {
    it('report-failed grava a falha com a Menção a quem pediu', async () => {
      const { ana, requestId } = await started();

      const response = await botRoutes.reportFailed(app, requestId);

      expect(response.status).toBe(201);
      const { message } = response.body as { message: MessageBody };
      expect(message).toMatchObject({
        author: { kind: 'bot' },
        body: `@${ana.person.username}, não consegui gerar o relatório.`,
        business_data: true,
        mentions: [{ id: ana.person.id, username: ana.person.username }],
      });
    });

    it.each([
      { dataAccess: true, blocked: false },
      { dataAccess: false, blocked: true },
    ])(
      'a Atividade de quem pediu traz a falha (Permissão de dados: $dataAccess)',
      async ({ dataAccess, blocked }) => {
        const { ana, requestId } = await scene({ dataAccess });
        await botRoutes.reportStarted(app, requestId).expect(201);
        const failed = (
          (await botRoutes.reportFailed(app, requestId).expect(201)).body as {
            message: MessageBody;
          }
        ).message;

        const activity = await activityOf(ana.cookie);

        expect(activity.items).toContainEqual(
          expect.objectContaining({
            kind: 'mention',
            message: expect.objectContaining({
              id: failed.id,
              body: blocked ? '' : failed.body,
              blocked,
            }) as unknown,
          }),
        );
      },
    );

    it('a Mensagem de bot sem Menção continua fora da Atividade', async () => {
      const { ana, requestId } = await started();

      const activity = await activityOf(ana.cookie);

      const [{ message_id }] = await botRoutes.actionRows(app, requestId);
      expect(activity.items.map((item) => item.message.id)).not.toContain(
        message_id,
      );
    });
  });

  describe('credenciais', () => {
    it.each([
      ['do Worker', TEST_WORKER_TOKEN],
      ['de bot', TEST_BOT_TOKEN],
    ])('report-failed aceita o segredo %s', async (_, token) => {
      const { requestId } = await started();

      const response = await botRoutes.reportFailed(app, requestId, token);

      expect(response.status).toBe(201);
    });

    it.each([
      [
        'report-started',
        (id: string) =>
          botRoutes.reportStarted(app, id, REPORT_NOTICE, TEST_WORKER_TOKEN),
      ],
      [
        'reply',
        (id: string) => botRoutes.reply(app, id, 'Oi', TEST_WORKER_TOKEN),
      ],
      ['typing', (id: string) => botRoutes.typing(app, id, TEST_WORKER_TOKEN)],
      [
        'messages',
        (id: string) => botRoutes.readMessages(app, id, {}, TEST_WORKER_TOKEN),
      ],
    ])('o segredo do Worker é recusado em %s', async (_, call) => {
      const { requestId } = await scene();

      const response = await call(requestId);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'invalid_bot_token' });
    });

    it.each([
      ['sem credencial', null],
      ['com uma credencial errada', 'credencial-errada'],
    ])('report-failed %s responde 401', async (_, token) => {
      const { requestId } = await started();

      const response = await botRoutes.reportFailed(app, requestId, token);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'invalid_bot_token' });
    });
  });

  describe('report-delivered', () => {
    async function reportRows(messageId: string) {
      return app
        .get(DataSource)
        .query<
          { storage_key: string; file_name: string; size_bytes: number }[]
        >(
          'SELECT storage_key, file_name, size_bytes FROM message_reports WHERE message_id = $1',
          [messageId],
        );
    }

    it('report-delivered grava a entrega com a referência ao PDF e a Menção', async () => {
      const { ana, requestId } = await started();

      const response = await botRoutes.reportDelivered(app, requestId);

      expect(response.status).toBe(201);
      const { message } = response.body as { message: MessageBody };
      expect(message).toMatchObject({
        author: { kind: 'bot' },
        body: `@${ana.person.username}, o relatório está pronto.`,
        business_data: true,
        mentions: [{ id: ana.person.id, username: ana.person.username }],
        report: { file_name: REPORT_FILE_NAME, size_bytes: 48_213 },
      });
      expect(message).not.toHaveProperty('report.storage_key');
      expect(await reportRows(message.id)).toEqual([
        {
          storage_key: `reports/${requestId}.pdf`,
          file_name: REPORT_FILE_NAME,
          size_bytes: 48_213,
        },
      ]);
    });

    it('report-delivered repetido devolve a mesma Mensagem', async () => {
      const { requestId } = await started();
      const first = (
        (await botRoutes.reportDelivered(app, requestId).expect(201)).body as {
          message: MessageBody;
        }
      ).message;

      const response = await botRoutes.reportDelivered(app, requestId);

      expect(response.status).toBe(201);
      expect((response.body as { message: MessageBody }).message).toMatchObject(
        {
          id: first.id,
          report: first.report,
        },
      );
      expect(await reportRows(first.id)).toHaveLength(1);
    });

    it('report-delivered depois da falha responde 409 request_closed', async () => {
      const { requestId } = await started();
      await botRoutes.reportFailed(app, requestId).expect(201);

      const response = await botRoutes.reportDelivered(app, requestId);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'request_closed' });
    });

    it('report-delivered sem o aviso responde 409 report_not_started', async () => {
      const { requestId } = await scene();

      const response = await botRoutes.reportDelivered(app, requestId);

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'report_not_started' });
    });

    it('report-delivered recusa o segredo de bot', async () => {
      const { requestId } = await started();

      const response = await botRoutes.reportDelivered(
        app,
        requestId,
        undefined,
        TEST_BOT_TOKEN,
      );

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'invalid_bot_token' });
    });

    it.each([
      ['a chave fora de reports/', { storage_key: 'outros/x.pdf' }],
      ['o nome sem .pdf', { file_name: 'relatorio.txt' }],
      [
        'o nome com mais de 200 caracteres',
        { file_name: `${'a'.repeat(197)}.pdf` },
      ],
      ['o tamanho zero', { size_bytes: 0 }],
      ['o tamanho fracionário', { size_bytes: 1.5 }],
    ])('report-delivered recusa %s', async (_, change) => {
      const { requestId } = await started();

      const response = await botRoutes.reportDelivered(app, requestId, {
        storage_key: `reports/${requestId}.pdf`,
        file_name: REPORT_FILE_NAME,
        size_bytes: 1000,
        ...change,
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'validation_failed' });
    });

    it('o histórico traz report a quem tem permissão e nulo na versão bloqueada', async () => {
      const { ana, bruno, channel, requestId } = await started();
      const delivered = (
        (await botRoutes.reportDelivered(app, requestId).expect(201)).body as {
          message: MessageBody;
        }
      ).message;
      const history = async (cookie: string) =>
        (
          (
            await conversationRoutes
              .listMessages(app, cookie, channel.id)
              .expect(200)
          ).body as { messages: MessageBody[] }
        ).messages;
      const toAna = await history(ana.cookie);

      const toBruno = await history(bruno.cookie);

      expect(toAna.find((m) => m.id === delivered.id)).toMatchObject({
        blocked: false,
        report: { file_name: REPORT_FILE_NAME, size_bytes: 48_213 },
      });
      expect(toBruno.find((m) => m.id === delivered.id)).toMatchObject({
        blocked: true,
        body: '',
        report: null,
      });
      expect(toBruno.filter((m) => m.id !== delivered.id)).toEqual(
        expect.arrayContaining([expect.objectContaining({ report: null })]),
      );
      expect(JSON.stringify(toAna)).not.toContain('storage_key');
    });

    it('a Atividade traz a entrega com report', async () => {
      const { ana, requestId } = await started();
      const delivered = (
        (await botRoutes.reportDelivered(app, requestId).expect(201)).body as {
          message: MessageBody;
        }
      ).message;

      const activity = await activityOf(ana.cookie);

      expect(activity.items).toContainEqual(
        expect.objectContaining({
          kind: 'mention',
          message: expect.objectContaining({
            id: delivered.id,
            report: { file_name: REPORT_FILE_NAME, size_bytes: 48_213 },
          }) as unknown,
        }),
      );
    });
  });
});
