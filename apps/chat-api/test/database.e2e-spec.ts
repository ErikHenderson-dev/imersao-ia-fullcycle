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
});
