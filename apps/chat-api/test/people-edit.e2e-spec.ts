import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { authRoutes } from './support/auth-routes';
import { createTestApp } from './support/create-test-app';

type ProfileBody = { person: { status: unknown } };

describe('edição do próprio Perfil', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function update(cookie: string, body: object) {
    return request(server)
      .patch('/v1/people/me')
      .set('Cookie', cookie)
      .send(body);
  }

  function profileOf(cookie: string, id: string) {
    return request(server).get(`/v1/people/${id}`).set('Cookie', cookie);
  }

  it('grava o nome, o cargo e o telefone e devolve o Perfil', async () => {
    const { person, cookie } = await authRoutes.loggedIn(app);

    const response = await update(cookie, {
      name: '  Ana Lima  ',
      title: ' Engenheira de Software ',
      phone: '+55 11 98888-0001',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      person: {
        id: person.id,
        name: 'Ana Lima',
        title: 'Engenheira de Software',
        phone: '+55 11 98888-0001',
      },
    });
    expect((await profileOf(cookie, person.id)).body).toEqual(response.body);
  });

  it('apaga o cargo e o telefone com nulo ou vazio, e não muda o campo ausente', async () => {
    const { person, cookie } = await authRoutes.loggedIn(app);
    await update(cookie, { title: 'Produto', phone: '1234' });

    const response = await update(cookie, { title: null, phone: '  ' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      person: { name: person.name, title: null, phone: null },
    });
  });

  it('não muda nada com o corpo vazio', async () => {
    const { person, cookie } = await authRoutes.loggedIn(app);

    const response = await update(cookie, {});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ person: { name: person.name } });
  });

  it.each([
    ['o nome nulo', { name: null }],
    ['o nome vazio', { name: '   ' }],
    ['o nome com quebra de linha', { name: 'Ana\nLima' }],
    ['o nome com 81 caracteres', { name: 'n'.repeat(81) }],
    ['o nome que não é texto', { name: 42 }],
    ['o nome com o caractere nulo', { name: 'Ana\u0000' }],
    ['o cargo com o caractere nulo', { title: 'Produto\u0000' }],
    ['o cargo com 81 caracteres', { title: 'c'.repeat(81) }],
    ['o telefone com letra', { phone: '+55 11 ABCD' }],
  ])('responde 400 validation_failed para %s', async (_case, body) => {
    const { person, cookie } = await authRoutes.loggedIn(app);

    const response = await update(cookie, body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
    expect((await profileOf(cookie, person.id)).body).toMatchObject({
      person: { name: person.name },
    });
  });

  it('grava o Status, e o texto sem emoji ganha o speech', async () => {
    const { cookie } = await authRoutes.loggedIn(app);

    const withEmoji = await update(cookie, {
      status_emoji: 'vacation',
      status_text: ' De férias até sexta ',
    });
    const onlyText = await update(cookie, {
      status_emoji: null,
      status_text: 'Em reunião',
    });

    expect((withEmoji.body as ProfileBody).person.status).toEqual({
      emoji: 'vacation',
      text: 'De férias até sexta',
    });
    expect((onlyText.body as ProfileBody).person.status).toEqual({
      emoji: 'speech',
      text: 'Em reunião',
    });
  });

  it('aceita o emoji sem mensagem e limpa o Status com os dois nulos', async () => {
    const { cookie } = await authRoutes.loggedIn(app);
    const onlyEmoji = await update(cookie, { status_emoji: 'headphones' });

    const cleared = await update(cookie, {
      status_emoji: null,
      status_text: null,
    });

    expect((onlyEmoji.body as ProfileBody).person.status).toEqual({
      emoji: 'headphones',
      text: null,
    });
    expect((cleared.body as ProfileBody).person.status).toBeNull();
  });

  it.each([
    ['a chave fora das sete', { status_emoji: 'party' }],
    ['a mensagem com 101 caracteres', { status_text: 's'.repeat(101) }],
    ['a mensagem com quebra de linha', { status_text: 'a\nb' }],
    ['a mensagem com o caractere nulo', { status_text: 'a\u0000' }],
  ])('responde 400 validation_failed para %s', async (_case, body) => {
    const { cookie } = await authRoutes.loggedIn(app);

    const response = await update(cookie, body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_failed' });
  });

  it('responde 401 sem Sessão', async () => {
    const response = await request(server)
      .patch('/v1/people/me')
      .send({ name: 'Ana' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'unauthenticated' });
  });
});
