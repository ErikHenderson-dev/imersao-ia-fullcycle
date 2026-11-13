import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PeopleService } from '../src/people/people.service';
import { authRoutes } from './support/auth-routes';
import { botRoutes, REPORT_FILE_NAME } from './support/bot-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';
import { putSamplePdf, SAMPLE_PDF } from './support/report-storage';

// O download do PDF do Relatório (spec da F14, "Referência ao PDF e download"; F14-T02, CA3).
describe('GET /v1/messages/:id/report', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  // A Ana (com Permissão de dados) pede o Relatório num Canal com o Bruno (sem); o Worker grava o
  // PDF no S3 e entrega.
  async function delivered() {
    const ana = await authRoutes.loggedIn(app, { name: 'Ana Souza' });
    const bruno = await authRoutes.loggedIn(app, { name: 'Bruno Lima' });
    await app.get(PeopleService).setDataAccess(ana.person.id, true);
    const channel = await conversationRoutes.createChannel(app);
    const bot = await conversationRoutes.createBot(app, 'Assistente');
    const requestId = await botRoutes.openedRequestId(
      app,
      ana.cookie,
      channel.id,
      bot.username,
    );
    await botRoutes.reportStarted(app, requestId).expect(201);
    await putSamplePdf(`reports/${requestId}.pdf`);
    const response = await botRoutes
      .reportDelivered(app, requestId)
      .expect(201);
    const messageId = (response.body as { message: { id: string } }).message.id;
    return { ana, bruno, channel, messageId, requestId };
  }

  function downloadUrl(cookie: string | null, messageId: string) {
    const call = request(server).get(`/v1/messages/${messageId}/report`);
    return cookie === null ? call : call.set('Cookie', cookie);
  }

  it('devolve a URL assinada que baixa o PDF', async () => {
    const { ana, messageId } = await delivered();

    const response = await downloadUrl(ana.cookie, messageId);

    expect(response.status).toBe(200);
    const { url } = response.body as { url: string };
    expect(new URL(url).origin).toBe(
      new URL(process.env.S3_PUBLIC_ENDPOINT!).origin,
    );
    const file = await fetch(url);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-disposition')).toBe(
      `attachment; filename="${REPORT_FILE_NAME}"`,
    );
    expect(Buffer.from(await file.arrayBuffer())).toEqual(SAMPLE_PDF);
  });

  it('responde 403 data_access_required sem Permissão de dados', async () => {
    const { bruno, messageId } = await delivered();

    const response = await downloadUrl(bruno.cookie, messageId);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'data_access_required' });
  });

  it('responde 404 a quem não é Membro', async () => {
    const { messageId } = await delivered();
    const outsider = await authRoutes.loggedIn(app);
    await app.get(PeopleService).setDataAccess(outsider.person.id, true);

    const response = await downloadUrl(outsider.cookie, messageId);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'message_not_found' });
  });

  it('responde 404 a uma Mensagem sem relatório', async () => {
    const { ana, channel } = await delivered();
    const plainId = await conversationRoutes.sentId(
      app,
      ana.cookie,
      channel.id,
      'Oi',
    );

    const response = await downloadUrl(ana.cookie, plainId);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'message_not_found' });
  });

  it('responde 404 a um id malformado', async () => {
    const { ana } = await delivered();

    const response = await downloadUrl(ana.cookie, 'nao-e-uuid');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'message_not_found' });
  });

  it('responde 401 sem Sessão', async () => {
    const { messageId } = await delivered();

    const response = await downloadUrl(null, messageId);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'unauthenticated' });
  });

  it('tirar a permissão muda o próximo pedido', async () => {
    const { ana, messageId } = await delivered();
    await downloadUrl(ana.cookie, messageId).expect(200);
    await app.get(PeopleService).setDataAccess(ana.person.id, false);

    const response = await downloadUrl(ana.cookie, messageId);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'data_access_required' });
  });
});
