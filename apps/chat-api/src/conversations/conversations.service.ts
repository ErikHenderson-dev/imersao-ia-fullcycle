import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { randomUUIDv7 } from 'node:crypto';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type { NewPerson } from '../people/people.service';
import { PeopleService } from '../people/people.service';
import type { Person } from '../people/person.entity';
import { ChannelNameTakenError } from './channel-name-taken.error';
import { ChannelNotFoundError } from './channel-not-found.error';
import {
  normalizeChannelName,
  parseChannelName,
  parseTopic,
} from './channel-name';
import { ConversationMember } from './conversation-member.entity';
import { ConversationNotFoundError } from './conversation-not-found.error';
import { Conversation, ConversationKind } from './conversation.entity';
import { InvalidChannelError } from './invalid-channel.error';
import { compareNames } from './name-order';
import { ChannelNotPrivateError } from './channel-not-private.error';
import { LastMemberError } from './last-member.error';
import { MembersNotEditableError } from './members-not-editable.error';
import { NotAMemberError } from './not-a-member.error';
import { normalizeEmail } from '../people/normalize-email';
import { PersonNotFoundError } from '../people/person-not-found.error';
import { lockPublicMembership } from './public-membership-lock';
import { InvalidPeopleError } from '../people/invalid-people.error';
import { PersonSummary, sortedSummaries } from '../people/person-summary';

// Tipos de Canal que a Pessoa cria pelo produto.
export type ChannelKind = Extract<
  ConversationKind,
  'public_channel' | 'private_channel'
>;

export interface NewChannel {
  kind: ChannelKind;
  name: string;
  topic?: string;
  clientId: string;
}

// Uma Conversa com a quantidade de Membros: o que a Conversa do REST e o evento do tempo real levam
// (spec da F04, "Rotas" e "Tempo real").
export interface ConversationSummary {
  conversation: Conversation;
  memberCount: number;
}

export interface CreatedChannel extends ConversationSummary {
  // Falso quando o client_id já tinha criado o Canal: o reenvio não grava nem publica nada.
  created: boolean;
  // As Pessoas que entraram agora, todas as Membros do Canal novo; vazio no reenvio.
  memberIds: string[];
}

export type PublicChannelSummary = {
  name: string;
  topic: string | null;
  memberCount: number;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly people: PeopleService,
  ) {}

  private get conversations(): Repository<Conversation> {
    return this.txHost.tx.getRepository(Conversation);
  }

  // Conversas de que a Pessoa é Membro, em ordem alfabética do nome ("name-order.ts").
  async listForMember(personId: string): Promise<Conversation[]> {
    const conversations = await this.memberConversations(personId).getMany();
    return conversations.sort((a, b) => compareNames(a.name, b.name));
  }

  // As Conversas com a quantidade de Membros de cada uma, na mesma ordem.
  async withMemberCounts(
    conversations: Conversation[],
  ): Promise<ConversationSummary[]> {
    const counts = await this.countMembers(
      conversations.map((conversation) => conversation.id),
    );
    return conversations.map((conversation) => ({
      conversation,
      memberCount: counts.get(conversation.id) ?? 0,
    }));
  }

  // Quantidade de Membros de cada Conversa pedida, numa consulta agrupada. A Conversa sem Membros
  // não aparece no mapa.
  private async countMembers(
    conversationIds: string[],
  ): Promise<Map<string, number>> {
    if (conversationIds.length === 0) return new Map();
    const rows = await this.txHost.tx
      .getRepository(ConversationMember)
      .createQueryBuilder('member')
      .select('member.conversation_id', 'conversation_id')
      .addSelect('count(*)', 'member_count')
      .where('member.conversation_id IN (:...conversationIds)', {
        conversationIds,
      })
      .groupBy('member.conversation_id')
      .getRawMany<{ conversation_id: string; member_count: string }>();
    return new Map(
      rows.map((row) => [row.conversation_id, Number(row.member_count)]),
    );
  }

  // Os Membros de uma Conversa de que a Pessoa é Membro, em ordem alfabética ("name-order.ts").
  async listMembers(
    personId: string,
    conversationId: string,
  ): Promise<PersonSummary[]> {
    await this.getForMember(personId, conversationId);
    return sortedSummaries(
      await this.people.findSummariesByIds(
        await this.listMemberIds(conversationId),
      ),
    );
  }

  // Ids das Pessoas que são Membros da Conversa: os destinatários dos eventos dela.
  async listMemberIds(conversationId: string): Promise<string[]> {
    const members = await this.txHost.tx
      .getRepository(ConversationMember)
      .find({ select: { personId: true }, where: { conversationId } });
    return members.map((member) => member.personId);
  }

  // A conferência de acesso única (LLD, "Segurança", "Participação numa Conversa"): toda rota e
  // todo service que recebe um id de Conversa passa por aqui.
  async getForMember(
    personId: string,
    conversationId: string,
  ): Promise<Conversation> {
    // Um id malformado não chega ao banco, que responderia erro de sintaxe.
    if (!isUUID(conversationId)) throw new ConversationNotFoundError();
    const conversation = await this.memberConversations(personId)
      .andWhere('conversation.id = :conversationId', { conversationId })
      .getOne();
    if (!conversation) throw new ConversationNotFoundError();
    return conversation;
  }

  // Cria o Canal pelo produto (spec da F04, "Conversas", "Criação"). O mesmo client_id da mesma
  // Pessoa devolve o Canal já criado, sem gravar nada, mesmo com outro nome.
  @Transactional()
  async createChannel(
    creatorId: string,
    { kind, name, topic, clientId }: NewChannel,
  ): Promise<CreatedChannel> {
    // A trava serializa as criações de Canal: a conferência do client_id e a do nome não correm
    // contra outra criação.
    await lockPublicMembership(this.txHost.tx);
    const existing = await this.conversations.findOneBy({
      createdBy: creatorId,
      clientId,
    });
    if (existing) {
      const [summary] = await this.withMemberCounts([existing]);
      return { ...summary, created: false, memberIds: [] };
    }
    // O público inclui todas as Pessoas; o privado, só quem o criou.
    const memberIds =
      kind === 'public_channel' ? await this.people.listIds() : [creatorId];
    const summary = await this.insertChannel(kind, name, topic, memberIds, {
      createdBy: creatorId,
      clientId,
    });
    return { ...summary, created: true, memberIds };
  }

  // Adiciona Pessoas ao Canal privado de que quem pede é Membro (spec da F04, "Conversas",
  // "Adicionar ao Canal"). Quem já é Membro fica como está e não entra em addedIds.
  @Transactional()
  async addMembers(
    personId: string,
    conversationId: string,
    personIds: string[],
  ): Promise<{
    summary: ConversationSummary;
    addedIds: string[];
    memberIds: string[];
  }> {
    const conversation = await this.getForMember(personId, conversationId);
    if (conversation.kind !== 'private_channel') {
      throw new MembersNotEditableError();
    }
    // Duas adições ao mesmo Canal acontecem uma depois da outra: a segunda lê os Membros já com os
    // da primeira, e o evento dela chega a todos. A remoção pelo comando toma a mesma trava, e a
    // participação de quem pede é conferida de novo depois dela: quem foi removido enquanto
    // esperava não adiciona ninguém.
    await this.txHost.tx.query(
      'SELECT 1 FROM conversations WHERE id = $1 FOR UPDATE',
      [conversation.id],
    );
    await this.getForMember(personId, conversation.id);
    const people = await this.people.findByIds(personIds);
    if (people.length !== new Set(personIds).size) {
      throw new InvalidPeopleError();
    }
    const addedIds = await this.insertMembers(
      personIds.map((id) => [conversation.id, id]),
    );
    // Os Membros depois da gravação: a quantidade da resposta e os destinatários do evento.
    const memberIds = await this.listMemberIds(conversation.id);
    return {
      summary: { conversation, memberCount: memberIds.length },
      addedIds,
      memberIds,
    };
  }

  // Cria o Canal público pelo comando de canais, sem criador nem client_id.
  @Transactional()
  async createPublicChannel(
    rawName: string,
    rawTopic?: string,
  ): Promise<Conversation> {
    await lockPublicMembership(this.txHost.tx);
    const { conversation } = await this.insertChannel(
      'public_channel',
      rawName,
      rawTopic,
      await this.people.listIds(),
      { createdBy: null, clientId: null },
    );
    return conversation;
  }

  // Só sob a trava de participação: valida, confere o nome entre todos os Canais e grava o Canal
  // com a participação das Pessoas que quem chama decide. A quantidade de Membros já se sabe sem
  // contar de novo.
  private async insertChannel(
    kind: ChannelKind,
    rawName: string,
    rawTopic: string | undefined,
    memberIds: string[],
    origin: { createdBy: string | null; clientId: string | null },
  ): Promise<ConversationSummary> {
    const name = parseChannelName(rawName);
    if (!name.ok) throw new InvalidChannelError(name.error);
    const topic = parseTopic(rawTopic);
    if (!topic.ok) throw new InvalidChannelError(topic.error);
    if (await this.conversations.existsBy({ name: name.value })) {
      throw new ChannelNameTakenError(name.value);
    }
    const channel = await this.conversations.save(
      this.conversations.create({
        kind,
        name: name.value,
        topic: topic.value,
        ...origin,
      }),
    );
    await this.insertMembers(
      memberIds.map((personId) => [channel.id, personId]),
    );
    return { conversation: channel, memberCount: memberIds.length };
  }

  // Troca o Tópico de um Canal público pela regra do create; vazio apaga. Devolve o nome
  // normalizado.
  async setPublicChannelTopic(
    rawName: string,
    rawTopic: string,
  ): Promise<{ name: string; topic: string | null }> {
    const topic = parseTopic(rawTopic);
    if (!topic.ok) throw new InvalidChannelError(topic.error);
    const name = normalizeChannelName(rawName);
    const result = await this.conversations.update(
      { kind: 'public_channel', name },
      { topic: topic.value },
    );
    if (!result.affected) throw new ChannelNotFoundError(name);
    return { name, topic: topic.value };
  }

  // Tira uma Pessoa de um Canal privado, pelo comando de canais (spec da F04, "Comando de
  // canais"). Sem evento: a Pessoa para de receber as Mensagens na hora, porque a publicação lê os
  // Membros a cada envio. Devolve o nome da Pessoa e o do Canal, normalizado.
  @Transactional()
  async removeMember(
    rawChannelName: string,
    email: string,
  ): Promise<{ personName: string; channelName: string }> {
    const name = normalizeChannelName(rawChannelName);
    const channel = await this.conversations.findOneBy({ name });
    if (!channel) throw new ChannelNotFoundError(name);
    if (channel.kind !== 'private_channel') {
      throw new ChannelNotPrivateError(name);
    }
    // Em série com as adições ao mesmo Canal (addMembers).
    await this.txHost.tx.query(
      'SELECT 1 FROM conversations WHERE id = $1 FOR UPDATE',
      [channel.id],
    );
    const person = await this.people.findByEmail(email);
    if (!person) throw new PersonNotFoundError(normalizeEmail(email));
    const memberIds = await this.listMemberIds(channel.id);
    if (!memberIds.includes(person.id)) {
      throw new NotAMemberError(person.name, name);
    }
    if (memberIds.length === 1) throw new LastMemberError(person.name, name);
    await this.txHost.tx
      .getRepository(ConversationMember)
      .delete({ conversationId: channel.id, personId: person.id });
    return { personName: person.name, channelName: name };
  }

  // Canais públicos em ordem alfabética ("name-order.ts"), com o número de Membros.
  async listPublicChannels(): Promise<PublicChannelSummary[]> {
    const rows = await this.conversations
      .createQueryBuilder('conversation')
      .leftJoin(
        ConversationMember,
        'member',
        'member.conversation_id = conversation.id',
      )
      .select('conversation.name', 'name')
      .addSelect('conversation.topic', 'topic')
      .addSelect('count(member.id)', 'member_count')
      .where("conversation.kind = 'public_channel'")
      .groupBy('conversation.id')
      .getRawMany<{
        name: string;
        topic: string | null;
        member_count: string;
      }>();
    return rows
      .sort((a, b) => compareNames(a.name, b.name))
      .map((row) => ({
        name: row.name,
        topic: row.topic,
        memberCount: Number(row.member_count),
      }));
  }

  // Cria a conta e a inclui em todos os Canais públicos, numa transação (ADR 0024). A Pessoa é
  // gravada antes da trava, para o hash da senha não segurá-la: um Canal criado ao mesmo tempo não
  // a vê (ainda não confirmada), e a leitura dos Canais, depois da trava, vê o Canal dele.
  @Transactional()
  async createPersonInPublicChannels(newPerson: NewPerson): Promise<Person> {
    const person = await this.people.create(newPerson);
    await lockPublicMembership(this.txHost.tx);
    await this.addToPublicChannels(person.id);
    return person;
  }

  // Só sob a trava de participação, dentro de createPersonInPublicChannels.
  private async addToPublicChannels(personId: string): Promise<void> {
    const channels = await this.conversations.find({
      select: { id: true },
      where: { kind: 'public_channel' },
    });
    await this.insertMembers(channels.map((channel) => [channel.id, personId]));
  }

  // Grava as participações (Conversa, Pessoa); a que já existe fica como está. Os ids saem da
  // aplicação, e os pares vão como arrays: o número de parâmetros não cresce com o workspace.
  // Devolve as Pessoas gravadas agora.
  private async insertMembers(pairs: [string, string][]): Promise<string[]> {
    const rows = await this.txHost.tx.query<{ person_id: string }[]>(
      `INSERT INTO conversation_members (id, conversation_id, person_id)
       SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::uuid[])
       ON CONFLICT (conversation_id, person_id) DO NOTHING
       RETURNING person_id`,
      [
        pairs.map(() => randomUUIDv7()),
        pairs.map(([conversationId]) => conversationId),
        pairs.map(([, personId]) => personId),
      ],
    );
    return rows.map((row) => row.person_id);
  }

  private memberConversations(
    personId: string,
  ): SelectQueryBuilder<Conversation> {
    return this.conversations
      .createQueryBuilder('conversation')
      .innerJoin(
        ConversationMember,
        'member',
        'member.conversation_id = conversation.id AND member.person_id = :personId',
        { personId },
      );
  }
}
