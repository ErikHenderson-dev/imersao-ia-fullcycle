import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUIDv7 } from 'node:crypto';
import { LessThan, Repository } from 'typeorm';
import { ConversationsService } from '../conversations/conversations.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PeopleService } from '../people/people.service';
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
}

interface Barrier {
  done: Promise<void>;
  release: () => void;
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
    // A barreira desta Mensagem, se ela for a que põe a outra Pessoa na Conversa direta: montada
    // dentro da transação (em `send`), antes do commit, e liberada depois da publicação.
    let barrier: Barrier | null = null;
    let sent: SentMessage;
    try {
      sent = await this.send(author, conversationId, newMessage, (created) => {
        barrier = created;
      });
    } catch (error) {
      (barrier as Barrier | null)?.release();
      throw error;
    }
    const { message, created, joinedId } = sent;
    const own = barrier as Barrier | null;
    if (!created) return message;
    // Uma Mensagem que não abre a Conversa direta espera a barreira que estiver montada nela, para
    // a entrada da outra Pessoa chegar antes de qualquer Mensagem (spec da F05, "Tempo real",
    // "Ordem"). Sem barreira, a publicação sai na hora, sem prender a resposta do envio.
    const waitFor = own
      ? Promise.resolve()
      : this.barriers.get(conversationId)?.done;
    void (waitFor ?? Promise.resolve())
      .then(async () => {
        const memberIds =
          await this.conversations.listMemberIds(conversationId);
        if (joinedId) {
          // Uma falha aqui fica no log e não segura a Mensagem.
          await this.memberships
            .announceDirectJoin(conversationId, memberIds, joinedId)
            .catch((error: unknown) =>
              this.logger.error(
                'Falha ao publicar a participação gravada',
                error,
              ),
            );
        }
        await this.publisher.messageCreated(
          memberIds,
          toMessageResponse(message),
        );
      })
      .catch((error: unknown) =>
        this.logger.error('Falha ao publicar a Mensagem gravada', error),
      )
      .finally(() => own?.release());
    return message;
  }

  // As barreiras das Conversas diretas cuja outra Pessoa acabou de entrar e ainda não foi anunciada.
  // A API roda numa instância só.
  private readonly barriers = new Map<string, Barrier>();

  private raiseBarrier(conversationId: string): Barrier {
    let release!: () => void;
    const done = new Promise<void>((resolve) => {
      release = resolve;
    });
    const barrier: Barrier = {
      done,
      release: () => {
        release();
        if (this.barriers.get(conversationId) === barrier) {
          this.barriers.delete(conversationId);
        }
      },
    };
    this.barriers.set(conversationId, barrier);
    return barrier;
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
    onBarrier: (barrier: Barrier) => void,
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
    // Antes do commit: outro envio na mesma Conversa espera esta participação no índice único e,
    // quando passa, já encontra a barreira.
    if (joinedId) onBarrier(this.raiseBarrier(conversationId));
    return {
      message: toView(message, author),
      created: Boolean(row),
      joinedId,
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
