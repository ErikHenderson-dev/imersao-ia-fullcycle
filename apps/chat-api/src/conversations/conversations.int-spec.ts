import { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID, randomUUIDv7 } from 'node:crypto';
import { DataSource } from 'typeorm';
import { uniqueChannelName } from '../../test/support/unique-channel-name';
import { uniqueEmail } from '../../test/support/unique-email';
import { AppConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { PeopleService } from '../people/people.service';
import { ConversationsModule } from './conversations.module';
import { ConversationsService } from './conversations.service';

// As restrições que o banco impõe sozinho, abaixo das regras do service (spec da F02,
// "Conversas e participação" e "Mensagens").
describe('restrições das Conversas no banco', () => {
  let context: INestApplicationContext;
  let dataSource: DataSource;
  let conversations: ConversationsService;
  let people: PeopleService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, DatabaseModule, ConversationsModule],
    }).compile();
    context = await moduleRef.init();
    dataSource = context.get(DataSource);
    conversations = context.get(ConversationsService);
    people = context.get(PeopleService);
  });

  afterAll(async () => {
    await context.close();
  });

  it('o banco recusa um Canal com nome repetido', async () => {
    const channel =
      await conversations.createPublicChannel(uniqueChannelName());

    const insert = dataSource.query(
      `INSERT INTO conversations (id, kind, name) VALUES ($1, 'public_channel', $2)`,
      [randomUUIDv7(), channel.name],
    );

    await expect(insert).rejects.toThrow('conversations_name_key');
  });

  it('o banco recusa uma Mensagem acima do limite', async () => {
    const author = await people.create({
      email: uniqueEmail(),
      name: 'Ana Souza',
      password: 'senha',
    });
    const channel =
      await conversations.createPublicChannel(uniqueChannelName());

    const insert = dataSource.query(
      `INSERT INTO messages (id, conversation_id, author_person_id, client_id, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUIDv7(), channel.id, author.id, randomUUID(), '😀'.repeat(4001)],
    );

    await expect(insert).rejects.toThrow('messages_body_check');
  });
});
