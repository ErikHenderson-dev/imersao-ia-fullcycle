import { randomUUID } from 'node:crypto';
import { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { verify } from '@node-rs/argon2';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import { uniqueEmail } from '../../test/support/unique-email';
import { uniqueChannelName } from '../../test/support/unique-channel-name';
import { ConversationsService } from '../conversations/conversations.service';
import { lockPublicMembership } from '../conversations/public-membership-lock';
import { PeopleService } from '../people/people.service';
import { SessionsService } from '../sessions/sessions.service';
import { CommandOutput } from '../common/cli/command';
import { AccountsCommand } from './accounts.command';
import { AccountsModule } from './accounts.module';

function givenPassword(password: string) {
  return { ask: () => Promise.resolve(password) };
}

function recordingOutput(): CommandOutput & { errors: string[] } {
  const errors: string[] = [];
  return { errors, info: () => undefined, error: (m) => errors.push(m) };
}

describe('comando de contas', () => {
  let context: INestApplicationContext;
  let people: PeopleService;
  let conversations: ConversationsService;
  let sessions: SessionsService;
  let dataSource: DataSource;
  let cls: ClsService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AccountsModule],
    }).compile();
    context = await moduleRef.init();
    people = context.get(PeopleService);
    conversations = context.get(ConversationsService);
    sessions = context.get(SessionsService);
    dataSource = context.get(DataSource);
    cls = context.get(ClsService);
  });

  afterAll(async () => {
    await context.close();
  });

  // Como o cli.ts: cada execução do comando roda dentro de um contexto do CLS.
  function command(password = 'senha-do-terminal', output = recordingOutput()) {
    const accounts = new AccountsCommand(
      people,
      conversations,
      sessions,
      givenPassword(password),
      output,
    );
    return { run: (argv: string[]) => cls.run(() => accounts.run(argv)) };
  }

  async function personWithSessions(count: number) {
    const email = uniqueEmail();
    const person = await people.create({
      email,
      name: 'Ana Souza',
      password: 'senha-antiga',
    });
    for (let i = 0; i < count; i += 1)
      await sessions.login(email, 'senha-antiga');
    return person;
  }

  async function sessionCount(personId: string): Promise<number> {
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM sessions WHERE person_id = $1',
      [personId],
    );
    return Number(count);
  }

  describe('create', () => {
    it('cria a Pessoa com o e-mail normalizado e a senha em Argon2id', async () => {
      const email = uniqueEmail();

      const exitCode = await command().run([
        'create',
        `  ${email.toUpperCase()} `,
        'Ana Souza',
      ]);

      expect(exitCode).toBe(0);
      const person = await people.findByEmail(email);
      expect(person).toMatchObject({ email, name: 'Ana Souza' });
      expect(person?.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(await verify(person!.passwordHash, 'senha-do-terminal')).toBe(
        true,
      );
    });

    it('inclui a Pessoa em todos os Canais públicos', async () => {
      const channels = [
        await conversations.createPublicChannel(uniqueChannelName()),
        await conversations.createPublicChannel(uniqueChannelName()),
      ];
      const email = uniqueEmail();

      const exitCode = await command().run(['create', email, 'Ana Souza']);

      expect(exitCode).toBe(0);
      const person = await people.findByEmail(email);
      const [{ outside }] = await dataSource.query<{ outside: string }[]>(
        `SELECT count(*) AS outside FROM conversations c
         WHERE c.kind = 'public_channel'
           AND NOT EXISTS (SELECT 1 FROM conversation_members m
                           WHERE m.conversation_id = c.id AND m.person_id = $1)`,
        [person!.id],
      );
      expect(Number(outside)).toBe(0);
      const memberships = await dataSource.query<unknown[]>(
        'SELECT 1 FROM conversation_members WHERE person_id = $1 AND conversation_id = ANY($2)',
        [person!.id, channels.map((channel) => channel.id)],
      );
      expect(memberships).toHaveLength(2);
    });

    it('a conta nova não entra nos Canais privados', async () => {
      const owner = await people.create({
        email: uniqueEmail(),
        name: 'Bruno Lima',
        password: 'senha',
      });
      const { conversation: channel } = await conversations.createChannel(
        owner.id,
        {
          kind: 'private_channel',
          name: uniqueChannelName(),
          clientId: randomUUID(),
        },
      );
      const email = uniqueEmail();

      const exitCode = await command().run(['create', email, 'Ana Souza']);

      expect(exitCode).toBe(0);
      const person = await people.findByEmail(email);
      const memberships = await dataSource.query<unknown[]>(
        'SELECT 1 FROM conversation_members WHERE person_id = $1 AND conversation_id = $2',
        [person!.id, channel.id],
      );
      expect(memberships).toHaveLength(0);
    });

    it('desfaz a Pessoa quando a participação falha', async () => {
      const email = uniqueEmail();
      // O método é privado: a troca é pelo protótipo, só neste teste.
      const failure = jest
        .spyOn(
          ConversationsService.prototype as unknown as {
            addToPublicChannels: (personId: string) => Promise<void>;
          },
          'addToPublicChannels',
        )
        .mockRejectedValueOnce(new Error('falha ao gravar a participação'));

      await expect(
        command().run(['create', email, 'Ana Souza']),
      ).rejects.toThrow('falha ao gravar a participação');

      failure.mockRestore();
      expect(await people.findByEmail(email)).toBeNull();
    });

    it('espera a trava de participação tomada por outra transação', async () => {
      const email = uniqueEmail();
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      await lockPublicMembership(runner.manager);

      let finished = false;
      let creation: Promise<number>;
      try {
        creation = command()
          .run(['create', email, 'Ana Souza'])
          .then((code) => {
            finished = true;
            return code;
          });
        // Tempo de sobra para a criação chegar à trava e ficar parada nela.
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(finished).toBe(false);
      } finally {
        // Solta a trava mesmo com a asserção falhando, para a suíte não travar.
        await runner.commitTransaction();
        await runner.release();
      }
      expect(await creation).toBe(0);
      expect(await people.findByEmail(email)).not.toBeNull();
    });

    it('recusa um e-mail que já existe', async () => {
      const email = uniqueEmail();
      await people.create({ email, name: 'Ana Souza', password: 'senha-1' });
      const output = recordingOutput();

      const exitCode = await command('senha-2', output).run([
        'create',
        email,
        'Outra Ana',
      ]);

      expect(exitCode).toBe(1);
      expect(output.errors.join('\n')).toContain('Já existe');
      expect(await people.findByEmail(email)).toMatchObject({
        name: 'Ana Souza',
      });
    });

    it('recusa uma senha acima de 256 caracteres', async () => {
      const email = uniqueEmail();
      const output = recordingOutput();

      const exitCode = await command('a'.repeat(257), output).run([
        'create',
        email,
        'Ana Souza',
      ]);

      expect(exitCode).toBe(1);
      expect(output.errors.join('\n')).toContain('no máximo 256');
      expect(await people.findByEmail(email)).toBeNull();
    });
  });

  describe('revoke-sessions', () => {
    it('apaga todas as Sessões da Pessoa', async () => {
      const person = await personWithSessions(2);

      const exitCode = await command().run(['revoke-sessions', person.email]);

      expect(exitCode).toBe(0);
      expect(await sessionCount(person.id)).toBe(0);
    });

    it('recusa operação com e-mail sem conta', async () => {
      const output = recordingOutput();

      const exitCode = await command('x', output).run([
        'revoke-sessions',
        uniqueEmail(),
      ]);

      expect(exitCode).toBe(1);
      expect(output.errors.join('\n')).toContain('Nenhuma Pessoa');
    });
  });

  describe('reset-password', () => {
    it('recusa uma senha nova acima de 256 caracteres e não revoga nada', async () => {
      const person = await personWithSessions(1);
      const output = recordingOutput();

      const exitCode = await command('a'.repeat(257), output).run([
        'reset-password',
        person.email,
      ]);

      expect(exitCode).toBe(1);
      expect(output.errors.join('\n')).toContain('no máximo 256');
      expect(await sessionCount(person.id)).toBe(1);
    });

    it('não cria a Sessão de um login que conferiu a senha antiga antes da redefinição', async () => {
      const person = await personWithSessions(0);
      const checkedWithOldPassword = await people.verifyCredentials(
        person.email,
        'senha-antiga',
      );
      await command('senha-nova').run(['reset-password', person.email]);

      const attempt = sessions.startSession(checkedWithOldPassword!);

      await expect(attempt).rejects.toThrow('E-mail ou senha incorretos.');
      expect(await sessionCount(person.id)).toBe(0);
    });

    it('troca a senha e revoga todas as Sessões', async () => {
      const person = await personWithSessions(1);

      const exitCode = await command('senha-nova').run([
        'reset-password',
        person.email,
      ]);

      expect(exitCode).toBe(0);
      const updated = await people.findByEmail(person.email);
      expect(await verify(updated!.passwordHash, 'senha-nova')).toBe(true);
      expect(await verify(updated!.passwordHash, 'senha-antiga')).toBe(false);
      expect(await sessionCount(person.id)).toBe(0);
    });

    it('não troca a senha quando a revogação falha na mesma transação', async () => {
      const person = await personWithSessions(1);

      const attempt = people.changePassword(person.id, 'senha-nova', () =>
        Promise.reject(new Error('falha na revogação')),
      );

      await expect(attempt).rejects.toThrow('falha na revogação');
      const unchanged = await people.findByEmail(person.email);
      expect(await verify(unchanged!.passwordHash, 'senha-antiga')).toBe(true);
      expect(await sessionCount(person.id)).toBe(1);
    });

    it('recusa operação com e-mail sem conta', async () => {
      const output = recordingOutput();

      const exitCode = await command('x', output).run([
        'reset-password',
        uniqueEmail(),
      ]);

      expect(exitCode).toBe(1);
      expect(output.errors.join('\n')).toContain('Nenhuma Pessoa');
    });
  });

  describe('purge-expired-sessions', () => {
    it('apaga só as Sessões vencidas', async () => {
      const person = await personWithSessions(2);
      await dataSource.query(
        `UPDATE sessions SET expires_at = now() - interval '1 day'
         WHERE id = (SELECT id FROM sessions WHERE person_id = $1 ORDER BY id LIMIT 1)`,
        [person.id],
      );

      const exitCode = await command().run(['purge-expired-sessions']);

      expect(exitCode).toBe(0);
      expect(await sessionCount(person.id)).toBe(1);
    });
  });

  describe('perfil na criação', () => {
    function freeUsername(): string {
      return `u${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    }

    it('create grava o @usuário, o cargo e o telefone informados', async () => {
      const email = uniqueEmail();
      const username = freeUsername();

      const exitCode = await command().run([
        'create',
        email,
        'Ana Souza',
        '--username',
        username,
        '--title',
        ' Product Manager ',
        '--phone',
        '+55 (11) 98888-0001',
      ]);

      expect(exitCode).toBe(0);
      expect(await people.findByEmail(email)).toMatchObject({
        username,
        title: 'Product Manager',
        phone: '+55 (11) 98888-0001',
        timeZone: null,
      });
    });

    it('create deriva o @usuário do e-mail, com sufixo quando repete', async () => {
      const local = `ana.${randomUUID().slice(0, 8)}`;
      await command().run(['create', `${local}@a.local`, 'Ana Souza']);

      const exitCode = await command().run([
        'create',
        `${local.toUpperCase()}@b.local`,
        'Ana Lima',
      ]);

      expect(exitCode).toBe(0);
      expect((await people.findByEmail(`${local}@a.local`))?.username).toBe(
        local,
      );
      expect((await people.findByEmail(`${local}@b.local`))?.username).toBe(
        `${local}2`,
      );
    });

    it('create grava cargo e telefone vazios como nulos', async () => {
      const email = uniqueEmail();

      const exitCode = await command().run([
        'create',
        email,
        'Ana Souza',
        '--title',
        '  ',
        '--phone',
        '',
      ]);

      expect(exitCode).toBe(0);
      expect(await people.findByEmail(email)).toMatchObject({
        title: null,
        phone: null,
      });
    });

    it.each([
      ['o @usuário já usado', ['--username', 'TAKEN'], /já é de outra Pessoa/],
      ['o @usuário fora do formato', ['--username', 'Ana Souza'], /@usuário/],
      ['o cargo com 81 caracteres', ['--title', 'c'.repeat(81)], /cargo/],
      ['o telefone com letra', ['--phone', '11 9999-ABCD'], /telefone/],
      ['uma opção desconhecida', ['--cargo', 'PM'], /Uso:/],
      ['uma opção sem valor', ['--title'], /Uso:/],
    ])('create recusa %s', async (_case, options, message) => {
      const taken = freeUsername();
      await command().run([
        'create',
        uniqueEmail(),
        'Bruno',
        '--username',
        taken,
      ]);
      const output = recordingOutput();
      const email = uniqueEmail();
      const args = options.map((option) =>
        option === 'TAKEN' ? taken : option,
      );

      const exitCode = await command(undefined, output).run([
        'create',
        email,
        'Ana Souza',
        ...args,
      ]);

      expect(exitCode).toBe(1);
      expect(output.errors.join('\n')).toMatch(message);
      expect(await people.findByEmail(email)).toBeNull();
    });
  });

  describe('update-profile', () => {
    async function personWithProfile() {
      const email = uniqueEmail();
      await command().run([
        'create',
        email,
        'Ana Souza',
        '--title',
        'Designer',
        '--phone',
        '+55 11 4000-0000',
      ]);
      return email;
    }

    it('update-profile troca o cargo e mantém o telefone', async () => {
      const email = await personWithProfile();

      const exitCode = await command().run([
        'update-profile',
        email,
        '--title',
        'Product Manager',
      ]);

      expect(exitCode).toBe(0);
      expect(await people.findByEmail(email)).toMatchObject({
        title: 'Product Manager',
        phone: '+55 11 4000-0000',
      });
    });

    it('update-profile apaga com valor vazio', async () => {
      const email = await personWithProfile();

      const exitCode = await command().run([
        'update-profile',
        email,
        '--phone',
        '',
      ]);

      expect(exitCode).toBe(0);
      expect(await people.findByEmail(email)).toMatchObject({
        title: 'Designer',
        phone: null,
      });
    });

    it.each([
      ['sem nenhuma opção', [], /Uso:/],
      ['o @usuário', ['--username', 'outro'], /Uso:/],
      ['o telefone fora da regra', ['--phone', 'ramal 12'], /telefone/],
      ['o cargo em duas linhas', ['--title', 'PM\nDados'], /cargo/],
    ])('update-profile recusa %s', async (_case, options, message) => {
      const email = await personWithProfile();
      const output = recordingOutput();

      const exitCode = await command(undefined, output).run([
        'update-profile',
        email,
        ...options,
      ]);

      expect(exitCode).toBe(1);
      expect(output.errors.join('\n')).toMatch(message);
      expect(await people.findByEmail(email)).toMatchObject({
        title: 'Designer',
        phone: '+55 11 4000-0000',
      });
    });

    it('update-profile recusa a conta inexistente', async () => {
      const output = recordingOutput();

      const exitCode = await command(undefined, output).run([
        'update-profile',
        uniqueEmail(),
        '--title',
        'PM',
      ]);

      expect(exitCode).toBe(1);
      expect(output.errors.join('\n')).toMatch(/Nenhuma Pessoa/);
    });
  });
});
