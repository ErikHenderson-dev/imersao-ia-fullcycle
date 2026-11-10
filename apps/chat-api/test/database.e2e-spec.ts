import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
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
      title?: string | null;
      phone?: string | null;
      timeZone?: string | null;
    }) {
      return app.get(DataSource).query(
        `INSERT INTO people (id, email, name, password_hash, username, title, phone, time_zone)
           VALUES ($1, $2, 'Ana', 'hash', $3, $4, $5, $6)`,
        [
          randomUUID(),
          uniqueEmail(),
          values.username,
          values.title ?? null,
          values.phone ?? null,
          values.timeZone ?? null,
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
    ])('people recusa %s', async (_case, values, violation) => {
      const username = 'username' in values ? values.username : freeUsername();

      const insert = insertPerson({ ...values, username });

      await expect(insert).rejects.toThrow(violation);
    });

    it('people recusa um @usuário repetido', async () => {
      const username = freeUsername();
      await insertPerson({ username });

      const insert = insertPerson({ username });

      await expect(insert).rejects.toThrow(/people_username_key/);
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
});
