import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { backfillLastRead } from '../migrations/support/backfill-last-read';
import { authRoutes } from './support/auth-routes';
import { conversationRoutes } from './support/conversation-routes';
import { createTestApp } from './support/create-test-app';
import { uniqueEmail } from './support/unique-email';

describe('banco de testes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('a aplicação de teste usa o banco chat_test com as migrações rodadas', async () => {
    const dataSource = app.get(DataSource);

    const [{ db, migrations }] = await dataSource.query<
      { db: string; migrations: string }[]
    >(
      "SELECT current_database() AS db, to_regclass('public.migrations') AS migrations",
    );

    expect(db).toBe('chat_test');
    expect(migrations).toBe('migrations');
  });

  describe('people', () => {
    function insertPerson(values: {
      username: string | null;
      name?: string;
      title?: string | null;
      phone?: string | null;
      timeZone?: string | null;
    }) {
      return app.get(DataSource).query(
        `INSERT INTO people (id, email, name, password_hash, username, title, phone, time_zone)
           VALUES ($1, $2, $7, 'hash', $3, $4, $5, $6)`,
        [
          randomUUID(),
          uniqueEmail(),
          values.username,
          values.title ?? null,
          values.phone ?? null,
          values.timeZone ?? null,
          values.name ?? 'Ana',
        ],
      );
    }

    function freeUsername(): string {
      return `u${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    }

    it.each([
      ['o @usuário nulo', { username: null }, /"username".*not-null/],
      [
        'o @usuário com maiúscula',
        { username: 'Ana-Souza' },
        /people_username_check/,
      ],
      [
        'o @usuário terminando em ponto',
        { username: 'ana.' },
        /people_username_check/,
      ],
      [
        'o @usuário com um caractere',
        { username: 'a' },
        /people_username_check/,
      ],
      [
        'o @usuário com 31 caracteres',
        { username: 'a'.repeat(31) },
        /people_username_check/,
      ],
      [
        'o cargo com 81 caracteres',
        { title: 'c'.repeat(81) },
        /people_title_check/,
      ],
      ['o cargo vazio', { title: '' }, /people_title_check/],
      [
        'o cargo com quebra de linha',
        { title: 'Produto\nDados' },
        /people_title_check/,
      ],
      [
        'o telefone com letra',
        { phone: '+55 11 9999-ABCD' },
        /people_phone_check/,
      ],
      [
        'o telefone com 31 caracteres',
        { phone: '1'.repeat(31) },
        /people_phone_check/,
      ],
      ['o telefone vazio', { phone: '' }, /people_phone_check/],
      ['o nome vazio', { name: '' }, /people_name_check/],
      [
        'o nome com 81 caracteres',
        { name: 'n'.repeat(81) },
        /people_name_check/,
      ],
      [
        'o nome com quebra de linha',
        { name: 'Ana\nSouza' },
        /people_name_check/,
      ],
    ])('people recusa %s', async (_case, values, violation) => {
      const username = 'username' in values ? values.username : freeUsername();

      const insert = insertPerson({ ...values, username });

      await expect(insert).rejects.toThrow(violation);
    });

    it.each([
      [
        'a chave de emoji fora das sete',
        "'party', NULL",
        /people_status_emoji_check/,
      ],
      [
        'o texto do Status com quebra de linha',
        "'sick', E'a\\nb'",
        /people_status_text_check/,
      ],
      [
        'o texto do Status com 101 caracteres',
        `'sick', '${'s'.repeat(101)}'`,
        /people_status_text_check/,
      ],
      [
        'o texto do Status sem emoji',
        "NULL, 'Em reunião'",
        /people_status_check/,
      ],
    ])('people recusa %s', async (_case, values, violation) => {
      const { person } = await authRoutes.loggedIn(app);

      const update = app
        .get(DataSource)
        .query(
          `UPDATE people SET (status_emoji, status_text) = (${values}) WHERE id = $1`,
          [person.id],
        );

      await expect(update).rejects.toThrow(violation);
    });

    it('people recusa um @usuário repetido', async () => {
      const username = freeUsername();
      await insertPerson({ username });

      const insert = insertPerson({ username });

      await expect(insert).rejects.toThrow(/people_username_key/);
    });

    it('people tem a marca de Atividade, nula por padrão', async () => {
      const { person } = await authRoutes.loggedIn(app);

      const [row] = await app
        .get(DataSource)
        .query<{ activity_read_message_id: string | null }[]>(
          'SELECT activity_read_message_id FROM people WHERE id = $1',
          [person.id],
        );

      expect(row).toEqual({ activity_read_message_id: null });
    });

    it('people aceita cargo, telefone e fuso nulos ou preenchidos', async () => {
      const insert = Promise.all([
        insertPerson({ username: freeUsername() }),
        insertPerson({
          username: freeUsername(),
          title: 'c'.repeat(80),
          phone: '+55 (11) 98888-0001',
          timeZone: 'America/Sao_Paulo',
        }),
      ]);

      await expect(insert).resolves.toBeDefined();
    });
  });

  describe('conversations', () => {
    async function twoPeople(): Promise<[string, string]> {
      const ids: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        const id = randomUUID();
        await app
          .get(DataSource)
          .query(
            `INSERT INTO people (id, email, name, password_hash, username) VALUES ($1, $2, 'Ana', 'hash', $3)`,
            [
              id,
              uniqueEmail(),
              `u${randomUUID().replaceAll('-', '').slice(0, 20)}`,
            ],
          );
        ids.push(id);
      }
      return ids.sort() as [string, string];
    }

    function insertConversation(values: {
      kind: string;
      name?: string | null;
      topic?: string | null;
      low?: string | null;
      high?: string | null;
    }) {
      return app.get(DataSource).query(
        `INSERT INTO conversations (id, kind, name, topic, direct_person_low_id, direct_person_high_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          values.kind,
          values.name ?? null,
          values.topic ?? null,
          values.low ?? null,
          values.high ?? null,
        ],
      );
    }

    it.each([
      [
        'a Conversa direta com nome',
        (l: string, h: string) => ({
          kind: 'direct',
          name: `dm-${randomUUID()}`,
          low: l,
          high: h,
        }),
      ],
      [
        'a Conversa direta com Tópico',
        (l: string, h: string) => ({
          kind: 'direct',
          topic: 'Tópico',
          low: l,
          high: h,
        }),
      ],
      ['a Conversa direta sem o par', () => ({ kind: 'direct' })],
      [
        'o par fora de ordem',
        (l: string, h: string) => ({ kind: 'direct', low: h, high: l }),
      ],
      [
        'o Canal com o par',
        (l: string, h: string) => ({
          kind: 'public_channel',
          name: `c-${randomUUID().slice(0, 8)}`,
          low: l,
          high: h,
        }),
      ],
    ])('conversations recusa %s', async (_case, build) => {
      const [low, high] = await twoPeople();

      const insert = insertConversation(build(low, high));

      await expect(insert).rejects.toThrow(
        /conversations_(direct|kind|channel_name)_check/,
      );
    });

    it('conversations recusa uma segunda Conversa direta do mesmo par', async () => {
      const [low, high] = await twoPeople();
      await insertConversation({ kind: 'direct', low, high });

      const insert = insertConversation({ kind: 'direct', low, high });

      await expect(insert).rejects.toThrow(/conversations_direct_pair_key/);
    });

    it('conversations aceita a Conversa direta de uma Pessoa consigo mesma', async () => {
      const [low] = await twoPeople();

      const insert = insertConversation({ kind: 'direct', low, high: low });

      await expect(insert).resolves.toBeDefined();
    });
  });
  describe('messages', () => {
    // Uma Pessoa e um Canal direto no banco, para a Mensagem ter as referências.
    async function insertMessage(values: {
      body: string | null;
      deletedAt: Date | null;
    }) {
      const dataSource = app.get(DataSource);
      const personId = randomUUID();
      const conversationId = randomUUID();
      await dataSource.query(
        `INSERT INTO people (id, email, name, password_hash, username)
           VALUES ($1, $2, 'Ana', 'hash', $3)`,
        [personId, uniqueEmail(), `ana${personId.slice(0, 8)}`],
      );
      await dataSource.query(
        `INSERT INTO conversations (id, kind, name) VALUES ($1, 'public_channel', $2)`,
        [conversationId, `c-${conversationId.slice(0, 8)}`],
      );
      return dataSource.query<unknown[]>(
        `INSERT INTO messages (id, conversation_id, author_id, client_id, body, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          conversationId,
          personId,
          randomUUID(),
          values.body,
          values.deletedAt,
        ],
      );
    }

    it('o CHECK de messages aceita a Mensagem viva e a apagada e recusa as misturas', async () => {
      await expect(
        insertMessage({ body: 'Viva', deletedAt: null }),
      ).resolves.toBeDefined();
      await expect(
        insertMessage({ body: null, deletedAt: new Date() }),
      ).resolves.toBeDefined();
      await expect(
        insertMessage({ body: 'Apagada com texto', deletedAt: new Date() }),
      ).rejects.toThrow(/messages_body_check/);
      await expect(
        insertMessage({ body: null, deletedAt: null }),
      ).rejects.toThrow(/messages_body_check/);
    });
  });

  describe('conversation_members', () => {
    it('o preenchimento da Última leitura põe cada participação na última Mensagem da Conversa', async () => {
      const dataSource = app.get(DataSource);
      const author = await authRoutes.loggedIn(app);
      const withMessages = await conversationRoutes.privateChannelOf(
        app,
        author.cookie,
      );
      const empty = await conversationRoutes.privateChannelOf(
        app,
        author.cookie,
      );
      const [, last] = await conversationRoutes.insertMessages(app, {
        conversationId: withMessages,
        authorId: author.person.id,
        count: 2,
      });
      await dataSource.query(
        'UPDATE messages SET body = NULL, deleted_at = now() WHERE id = $1',
        [last],
      );
      await dataSource.query(
        'UPDATE conversation_members SET last_read_message_id = NULL WHERE conversation_id = ANY($1)',
        [[withMessages, empty]],
      );
      const queryRunner = dataSource.createQueryRunner();

      await backfillLastRead(queryRunner, [withMessages, empty]).finally(() =>
        queryRunner.release(),
      );

      const rows = await dataSource.query<
        { conversation_id: string; last_read_message_id: string | null }[]
      >(
        'SELECT conversation_id, last_read_message_id FROM conversation_members WHERE conversation_id = ANY($1)',
        [[withMessages, empty]],
      );
      expect(
        Object.fromEntries(
          rows.map((row) => [row.conversation_id, row.last_read_message_id]),
        ),
      ).toEqual({
        [withMessages]: last,
        [empty]: null,
      });
    });
  });
});
