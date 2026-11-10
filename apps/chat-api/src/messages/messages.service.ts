import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUIDv7 } from 'node:crypto';
import { LessThan, Repository } from 'typeorm';
import { Conversation } from '../conversations/conversation.entity';
import { ConversationsService } from '../conversations/conversations.service';
import { PeopleService } from '../people/people.service';
import { MembershipsService } from '../memberships/memberships.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { ClientIdConflictError } from './client-id-conflict.error';
import { Message } from './message.entity';
import { toMessageResponse } from './message.response';

export interface MessageAuthor {
  id: string;
  name: string;
}

export interface MessageView {
  id: string;
  conversationId: string;
  clientId: string;
  author: MessageAuthor;
  body: string;
  createdAt: Date;
}

export interface MessagePage {
  messages: MessageView[];
  hasMore: boolean;
}

export interface PageRequest {
  before?: string;
  limit: number;
}

export interface NewMessage {
  clientId: string;
  body: string;
}

export interface SentMessage {
  message: MessageView;
  // Falso quando o client_id já tinha sido gravado: o reenvio não gera evento.
  created: boolean;
  // A Pessoa que virou Membro da Conversa direta com esta Mensagem (a primeira), ou null.
  joinedId: string | null;
  conversation: Conversation;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly conversations: ConversationsService,
    private readonly people: PeopleService,
    private readonly publisher: RealtimePublisher,
    private readonly memberships: MembershipsService,
  ) {}

  private get messages(): Repository<Message> {
    return this.txHost.tx.getRepository(Message);
  }

  // Uma página do histórico, em ordem cronológica: as `limit` Mensagens anteriores a `before`, ou
  // as mais recentes sem ele. Uma linha a mais diz se há Mensagens anteriores (LLD, "Interfaces").
  async listPage(
    personId: string,
    conversationId: string,
    { before, limit }: PageRequest,
  ): Promise<MessagePage> {
    await this.conversations.getForMember(personId, conversationId);
    const newestFirst = await this.messages.find({
      where: {
        conversationId,
        ...(before ? { id: LessThan(before) } : {}),
      },
      order: { id: 'DESC' },
      take: limit + 1,
    });
    const hasMore = newestFirst.length > limit;
    const page = newestFirst.slice(0, limit).reverse();
    return { messages: await this.withAuthors(page), hasMore };
  }

  // Envia a Mensagem: grava e, só quando a gravação é nova, publica o evento para os Membros, depois
  // da gravação (spec da F03, "Eventos por Pessoa e reconexão", "Publicação"). A Mensagem já está
  // gravada quando a publicação falha: o envio responde sucesso e a falha vai para o log, porque um
  // reenvio da Pessoa não publicaria de novo.
  async sendMessage(
    author: MessageAuthor,
    conversationId: string,
    newMessage: NewMessage,
  ): Promise<MessageView> {
    const { message, created, joinedId, conversation } = await this.send(
      author,
      conversationId,
      newMessage,
    );
    if (created) {
      // A gravação no Redis e a emissão não prendem a resposta do envio.
      this.publishInOrder(conversationId, Boolean(joinedId), async () => {
        const memberIds =
          await this.conversations.listMemberIds(conversationId);
        if (joinedId) {
          // Uma falha aqui fica no log e não segura a Mensagem.
          await this.announceJoin(conversation, memberIds, joinedId);
        }
        await this.publisher.messageCreated(
          memberIds,
          toMessageResponse(message),
        );
      });
    }
    return message;
  }

  // As publicações de uma Conversa que estão esperando a entrada da outra Pessoa da Conversa direta
  // ser publicada (spec da F05, "Tempo real", "Ordem"): uma Mensagem enviada logo depois da primeira
  // espera, para o member_added chegar antes de qualquer Mensagem. Sem entrada pendente, a
  // publicação sai na hora. A API roda numa instância só.
  private readonly pendingJoins = new Map<string, Promise<void>>();

  private publishInOrder(
    conversationId: string,
    announcesJoin: boolean,
    publish: () => Promise<void>,
  ): void {
    const pending = this.pendingJoins.get(conversationId);
    const run = (pending ?? Promise.resolve())
      .then(publish)
      .catch((error: unknown) =>
        this.logger.error('Falha ao publicar a Mensagem gravada', error),
      );
    if (!announcesJoin && !pending) return;
    this.pendingJoins.set(conversationId, run);
    void run.then(() => {
      if (this.pendingJoins.get(conversationId) === run) {
        this.pendingJoins.delete(conversationId);
      }
    });
  }

  private async announceJoin(
    conversation: Conversation,
    memberIds: string[],
    joinedId: string,
  ): Promise<void> {
    try {
      const [summary] = await this.conversations.withMemberCounts([
        conversation,
      ]);
      await this.memberships.announceMemberAdded(summary, memberIds, [
        joinedId,
      ]);
    } catch (error) {
      this.logger.error('Falha ao publicar a participação gravada', error);
    }
  }

  // Envio sem duplicar (LLD, "Concorrência e idempotência"): o mesmo `client_id` do mesmo autor
  // devolve a Mensagem já gravada, sem gravar outra; o texto do reenvio é ignorado. O conflito é
  // resolvido pela unicidade do banco, o que vale também para dois envios ao mesmo tempo.
  // Uma transação: a Mensagem e a participação da outra Pessoa da Conversa direta, na primeira
  // Mensagem, gravam juntas (spec da F05, "Conversa direta", "Primeira Mensagem").
  @Transactional()
  private async send(
    author: MessageAuthor,
    conversationId: string,
    { clientId, body }: NewMessage,
  ): Promise<SentMessage> {
    const conversation = await this.conversations.getForMember(
      author.id,
      conversationId,
    );
    const inserted = await this.messages
      .createQueryBuilder()
      .insert()
      .values({
        id: randomUUIDv7(),
        conversationId,
        authorId: author.id,
        clientId,
        body,
      })
      .orIgnore()
      .returning(['id', 'created_at'])
      .execute();
    const [row] = inserted.raw as { id: string; created_at: Date }[];
    // Sem conflito, a linha nova volta no RETURNING; com conflito, lê a que já estava lá.
    const message = row
      ? this.messages.create({
          id: row.id,
          conversationId,
          authorId: author.id,
          clientId,
          body,
          createdAt: row.created_at,
        })
      : await this.messages.findOneByOrFail({ authorId: author.id, clientId });
    // O mesmo client_id usado em outra Conversa não é reenvio desta.
    if (message.conversationId !== conversationId) {
      throw new ClientIdConflictError();
    }
    const joinedId = row
      ? await this.conversations.joinDirectCounterpart(conversation, author.id)
      : null;
    return {
      message: toView(message, author),
      created: Boolean(row),
      joinedId,
      conversation,
    };
  }

  // Os nomes dos autores vêm do PeopleService, numa consulta pelos ids da página.
  private async withAuthors(messages: Message[]): Promise<MessageView[]> {
    const authorIds = [...new Set(messages.map((message) => message.authorId))];
    const authors = new Map(
      (await this.people.findByIds(authorIds)).map((person) => [
        person.id,
        { id: person.id, name: person.name },
      ]),
    );
    return messages.map((message) =>
      toView(message, authors.get(message.authorId)!),
    );
  }
}

function toView(message: Message, author: MessageAuthor): MessageView {
  return {
    id: message.id,
    conversationId: message.conversationId,
    clientId: message.clientId,
    author,
    body: message.body,
    createdAt: message.createdAt,
  };
}
