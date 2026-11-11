import { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { uniqueChannelName } from '../../test/support/unique-channel-name';
import { uniqueEmail } from '../../test/support/unique-email';
import { CommandOutput } from '../common/cli/command';
import { ConversationNotFoundError } from '../conversations/conversation-not-found.error';
import { ConversationsService } from '../conversations/conversations.service';
import { PeopleService } from '../people/people.service';
import { ChannelsCommand } from './channels.command';
import { ChannelsModule } from './channels.module';

function recordingOutput(): CommandOutput & {
  errors: string[];
  infos: string[];
} {
  const errors: string[] = [];
  const infos: string[] = [];
  return {
    errors,
    infos,
    info: (m) => infos.push(m),
    error: (m) => errors.push(m),
  };
}

describe('comando de canais', () => {
  let context: INestApplicationContext;
  let dataSource: DataSource;
  let cls: ClsService;
  let conversations: ConversationsService;
  let people: PeopleService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ChannelsModule],
    }).compile();
    context = await moduleRef.init();
    dataSource = context.get(DataSource);
    cls = context.get(ClsService);
    conversations = context.get(ConversationsService);
    people = context.get(PeopleService);
  });

  afterAll(async () => {
    await context.close();
  });

  async function isMember(channelId: string, personId: string) {
    const rows = await dataSource.query<unknown[]>(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND person_id = $2',
      [channelId, personId],
    );
    return rows.length > 0;
  }

  // Como o cli.ts: cada execução do comando roda dentro de um contexto do CLS.
  function run(args: string[], output = recordingOutput()) {
    const command = new ChannelsCommand(conversations, output);
    return cls.run(() => command.run(args));
  }

  async function channelsNamed(name: string) {
    return dataSource.query<
      { id: string; kind: string; topic: string | null }[]
    >('SELECT id, kind, topic FROM conversations WHERE name = $1', [name]);
  }

  it('create grava o Canal com todas as Pessoas como Membros', async () => {
    const person = await people.create({
      email: uniqueEmail(),
      name: 'Ana Souza',
      password: 'senha',
    });
    const name = uniqueChannelName();
    // As Pessoas que já existem antes do comando: outras suítes criam Pessoas ao mesmo tempo, e as
    // que nascem durante ele não precisam entrar.
    const existing = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM people',
    );

    const exitCode = await run(['create', name, 'Conversas do time']);

    expect(exitCode).toBe(0);
    const [channel] = await channelsNamed(name);
    expect(channel).toMatchObject({
      kind: 'public_channel',
      topic: 'Conversas do time',
    });
    const [{ outside }] = await dataSource.query<{ outside: string }[]>(
      `SELECT count(*) AS outside FROM unnest($2::uuid[]) AS p(id)
       WHERE NOT EXISTS (SELECT 1 FROM conversation_members m
                         WHERE m.conversation_id = $1 AND m.person_id = p.id)`,
      [channel.id, existing.map((row) => row.id)],
    );
    expect(Number(outside)).toBe(0);
    expect(await isMember(channel.id, person.id)).toBe(true);
  });

  it('create recusa nome repetido', async () => {
    const name = uniqueChannelName();
    await run(['create', name]);
    const output = recordingOutput();

    const exitCode = await run(['create', name, 'Outro tópico'], output);

    expect(exitCode).toBe(1);
    expect(output.errors).toEqual([`Já existe um canal chamado #${name}.`]);
    expect(await channelsNamed(name)).toHaveLength(1);
  });

  it.each([
    ['com maiúsculas', 'Geral-X'],
    ['com espaço', 'time de produto'],
    ['com #', '#geral'],
  ])('create recusa nome %s', async (_caso, name) => {
    const output = recordingOutput();

    const exitCode = await run(['create', name], output);

    expect(exitCode).toBe(1);
    expect(output.errors).toHaveLength(1);
    expect(await channelsNamed(name)).toHaveLength(0);
  });

  it('create recusa um Tópico partido em vários argumentos, sem gravar o Canal', async () => {
    const name = uniqueChannelName();
    const output = recordingOutput();

    const exitCode = await run(
      ['create', name, 'Canal', 'da', 'empresa'],
      output,
    );

    expect(exitCode).toBe(1);
    expect(output.errors).toEqual([
      'Uso: pnpm channels create <nome> ["<tópico>"]',
    ]);
    expect(await channelsNamed(name)).toHaveLength(0);
  });

  it('create recusa Tópico com quebra de linha, sem gravar o Canal', async () => {
    const name = uniqueChannelName();
    const output = recordingOutput();

    const exitCode = await run(
      ['create', name, 'linha um\nlinha dois'],
      output,
    );

    expect(exitCode).toBe(1);
    expect(output.errors).toEqual(['O tópico precisa caber numa linha só.']);
    expect(await channelsNamed(name)).toHaveLength(0);
  });

  it('set-topic troca o Tópico e, com "", o apaga', async () => {
    const name = uniqueChannelName();
    await run(['create', name, 'Tópico antigo']);

    expect(await run(['set-topic', name, '  Tópico novo  '])).toBe(0);
    expect((await channelsNamed(name))[0].topic).toBe('Tópico novo');

    expect(await run(['set-topic', name, ''])).toBe(0);
    expect((await channelsNamed(name))[0].topic).toBeNull();
  });

  it('set-topic recusa um Canal que não existe', async () => {
    const name = uniqueChannelName();
    const output = recordingOutput();

    const exitCode = await run(['set-topic', name, 'Tópico'], output);

    expect(exitCode).toBe(1);
    expect(output.errors).toEqual([`Canal não encontrado: ${name}.`]);
  });

  it('set-topic recusa Tópico com quebra de linha, sem gravar', async () => {
    const name = uniqueChannelName();
    await run(['create', name, 'Tópico antigo']);
    const output = recordingOutput();

    const exitCode = await run(['set-topic', name, 'um\ndois'], output);

    expect(exitCode).toBe(1);
    expect(output.errors).toEqual(['O tópico precisa caber numa linha só.']);
    expect((await channelsNamed(name))[0].topic).toBe('Tópico antigo');
  });

  it('set-topic sem o Tópico mostra o uso', async () => {
    const output = recordingOutput();

    const exitCode = await run(['set-topic', uniqueChannelName()], output);

    expect(exitCode).toBe(1);
    expect(output.errors).toEqual([
      'Uso: pnpm channels set-topic <nome> "<tópico>"',
    ]);
  });

  it('list mostra os Canais em ordem, com o número de Membros e o Tópico', async () => {
    const prefix = uniqueChannelName();
    await people.create({
      email: uniqueEmail(),
      name: 'Ana Souza',
      password: 'senha',
    });
    await run(['create', `${prefix}-b`]);
    await run(['create', `${prefix}-a`, 'Avisos do time']);
    const lines: string[] = [];
    const output = { ...recordingOutput(), info: (m: string) => lines.push(m) };

    const exitCode = await run(['list'], output);

    expect(exitCode).toBe(0);
    // Outras suítes criam contas ao mesmo tempo, e elas entram nos Canais: o número de Membros
    // só é conferido no formato.
    const mine = lines.filter((line) => line.startsWith(`#${prefix}-`));
    expect(mine).toHaveLength(2);
    expect(mine[0]).toMatch(
      new RegExp(`^#${prefix}-a \\(\\d+ Membros?\\) Avisos do time$`),
    );
    expect(mine[1]).toMatch(new RegExp(`^#${prefix}-b \\(\\d+ Membros?\\)$`));
  });

  describe('remove-member', () => {
    // Um Canal privado de duas Pessoas, criado pelo service como o produto faz.
    async function privateChannelWithTwo() {
      const owner = await people.create({
        email: uniqueEmail(),
        name: 'Ana Souza',
        password: 'senha',
      });
      const member = await people.create({
        email: uniqueEmail(),
        name: 'Bruno Lima',
        password: 'senha',
      });
      const name = uniqueChannelName();
      const { conversation } = await cls.run(() =>
        conversations.createChannel(owner.id, {
          kind: 'private_channel',
          name,
          clientId: randomUUID(),
        }),
      );
      await cls.run(() =>
        conversations.addMembers(owner.id, conversation.id, [member.id]),
      );
      return { owner, member, name, channelId: conversation.id };
    }

    it('remove-member apaga a participação da Pessoa no Canal privado', async () => {
      const { owner, member, name, channelId } = await privateChannelWithTwo();
      const output = recordingOutput();

      const exitCode = await run(
        ['remove-member', name, member.email.toUpperCase()],
        output,
      );

      expect(exitCode).toBe(0);
      expect(output.infos).toEqual([`Bruno Lima saiu de #${name}.`]);
      expect(await isMember(channelId, member.id)).toBe(false);
      expect(await isMember(channelId, owner.id)).toBe(true);
      await expect(
        cls.run(() => conversations.getForMember(member.id, channelId)),
      ).rejects.toBeInstanceOf(ConversationNotFoundError);
    });

    type Fixture = Awaited<ReturnType<typeof privateChannelWithTwo>>;

    it.each<
      [string, (fixture: Fixture) => string[] | Promise<string[]>, string]
    >([
      [
        'Canal inexistente',
        ({ member }) => [uniqueChannelName(), member.email],
        'Canal não encontrado:',
      ],
      [
        'Canal público',
        async ({ member }) => {
          const channel =
            await conversations.createPublicChannel(uniqueChannelName());
          return [channel.name!, member.email];
        },
        'só é possível remover',
      ],
      [
        'e-mail sem conta',
        ({ name }) => [name, uniqueEmail()],
        'Nenhuma Pessoa com o e-mail',
      ],
      [
        'Pessoa que não é Membro',
        async ({ name }) => {
          const outsider = await people.create({
            email: uniqueEmail(),
            name: 'Carla Dias',
            password: 'senha',
          });
          return [name, outsider.email];
        },
        'não é Membro de',
      ],
      [
        'o último Membro',
        async ({ owner, member, name, channelId }) => {
          await dataSource.query(
            'DELETE FROM conversation_members WHERE conversation_id = $1 AND person_id = $2',
            [channelId, owner.id],
          );
          return [name, member.email];
        },
        'é o último Membro',
      ],
    ])(
      'remove-member recusa %s, sem mudar nada',
      async (_caso, build, text) => {
        const fixture = await privateChannelWithTwo();
        const args = await build(fixture);
        const output = recordingOutput();

        const exitCode = await run(['remove-member', ...args], output);

        expect(exitCode).toBe(1);
        expect(output.errors).toHaveLength(1);
        expect(output.errors[0].toLowerCase()).toContain(text.toLowerCase());
        expect(await isMember(fixture.channelId, fixture.member.id)).toBe(true);
      },
    );

    it.each([
      ['sem os dois argumentos', ['so-o-nome']],
      ['com argumento sobrando', ['canal', 'pessoa@teste.local', 'sobra']],
    ])('remove-member mostra o uso %s', async (_caso, args) => {
      const output = recordingOutput();

      const exitCode = await run(['remove-member', ...args], output);

      expect(exitCode).toBe(1);
      expect(output.errors).toEqual([
        'Uso: pnpm channels remove-member <nome> <e-mail>',
      ]);
    });
  });
});
