import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUIDv7 } from 'node:crypto';
import { isUUID } from 'class-validator';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ConversationNotFoundError } from '../conversations/conversation-not-found.error';
import { ConversationsService } from '../conversations/conversations.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PeopleService } from '../people/people.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { ClientIdConflictError } from './client-id-conflict.error';
import { Message } from './message.entity';
import { MessageNotFoundError } from './message-not-found.error';
import { MessageNotOwnedError } from './message-not-owned.error';
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
  editedAt: Date | null;
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

interface PublicationSlot {
  fill: (publish: (() => Promise<void>) | null) => void;
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
        // A Mensagem apagada sai da Conversa (spec da F06, "Histórico").
        deletedAt: IsNull(),
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
    const publication = (waitFor ?? Promise.resolve())
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
    // A edição e a exclusão desta Mensagem só publicam depois da criação (spec da F06, "Tempo
    // real", "Ordem"): a fila dela nasce aqui, antes de o envio responder.
    this.queueForMessage(message.id, () => publication);
    return message;
  }

  // As publicações pendentes de cada Mensagem, em fila: a criação, as edições e a exclusão saem na
  // ordem em que foram gravadas, mesmo publicando depois do commit. A API roda numa instância só.
  private readonly messageQueues = new Map<string, Promise<void>>();

  private queueForMessage(messageId: string, publish: () => Promise<void>) {
    const previous = this.messageQueues.get(messageId) ?? Promise.resolve();
    const next = previous.then(publish);
    this.messageQueues.set(messageId, next);
    void next.finally(() => {
      if (this.messageQueues.get(messageId) === next) {
        this.messageQueues.delete(messageId);
      }
    });
  }

  // Reserva o lugar da publicação na fila da Mensagem ainda com a trava de linha, antes do commit:
  // a ordem da fila é a dos commits, mesmo que a continuação de uma transação demore mais que a
  // seguinte. Depois do commit, o lugar recebe a publicação, ou nada (falha ou sem mudança).
  private reservePublication(messageId: string): PublicationSlot {
    let fill!: (publish: (() => Promise<void>) | null) => void;
    const ready = new Promise<(() => Promise<void>) | null>((resolve) => {
      fill = resolve;
    });
    this.queueForMessage(messageId, () => ready.then((publish) => publish?.()));
    return { fill };
  }

  // Grava numa transação que reserva o lugar da publicação e, depois do commit, enche esse lugar.
  private async withPublication<T>(
    run: (reserve: (messageId: string) => void) => Promise<T>,
    publishFor: (result: T) => (() => Promise<void>) | null,
  ): Promise<T> {
    let slot: PublicationSlot | null = null;
    let result: T;
    try {
      result = await run((messageId) => {
        slot = this.reservePublication(messageId);
      });
    } catch (error) {
      (slot as PublicationSlot | null)?.fill(null);
      throw error;
    }
    (slot as PublicationSlot | null)?.fill(publishFor(result));
    return result;
  }

  // Edita a própria Mensagem (spec da F06, "Editar"): grava numa transação e, só quando o texto
  // mudou, publica o message.updated para os Membros depois do commit. Como no envio, a falha da
  // publicação só vai para o log.
  async editMessage(
    author: MessageAuthor,
    conversationId: string,
    messageId: string,
    body: string,
  ): Promise<MessageView> {
    const { message } = await this.withPublication(
      (reserve) => this.edit(author, conversationId, messageId, body, reserve),
      ({ message: edited, changed }) =>
        changed
          ? this.toMembers(
              conversationId,
              (memberIds) =>
                this.publisher.messageUpdated(
                  memberIds,
                  toMessageResponse(edited),
                ),
              'Falha ao publicar a Mensagem editada',
            )
          : null,
    );
    return message;
  }

  // Apaga a própria Mensagem (spec da F06, "Apagar"): zera o texto e grava `deleted_at` numa
  // transação, e publica o message.deleted para os Membros depois do commit.
  async deleteMessage(
    personId: string,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.withPublication(
      (reserve) => this.remove(personId, conversationId, messageId, reserve),
      () =>
        this.toMembers(
          conversationId,
          (memberIds) =>
            this.publisher.messageDeleted(memberIds, {
              conversation_id: conversationId,
              message_id: messageId,
            }),
          'Falha ao publicar a Mensagem apagada',
        ),
    );
  }

  // Com a mesma trava de linha da edição. As Menções, quando existirem, ficam (spec da F06).
  @Transactional()
  private async remove(
    personId: string,
    conversationId: string,
    messageId: string,
    reserve: (messageId: string) => void,
  ): Promise<void> {
    const message = await this.lockOwnMessage(
      personId,
      conversationId,
      messageId,
    );
    reserve(message.id);
    await this.messages.update(
      { id: message.id },
      { body: null, deletedAt: new Date() },
    );
  }

  // A publicação de um evento para os Membros da Conversa, que a fila da Mensagem roda depois do
  // commit, sem prender a resposta: a gravação já valeu, e a falha só vai para o log (LLD,
  // "Transações").
  private toMembers(
    conversationId: string,
    publish: (memberIds: string[]) => Promise<void>,
    failureLog: string,
  ): () => Promise<void> {
    return () =>
      this.conversations
        .listMemberIds(conversationId)
        .then(publish)
        .catch((error: unknown) => this.logger.error(failureLog, error));
  }

  // A trava de linha põe a edição e a exclusão da mesma Mensagem em fila (LLD, "Concorrência e
  // idempotência", "Editar e apagar mensagem"): a que chega depois lê a linha já gravada.
  @Transactional()
  private async edit(
    author: MessageAuthor,
    conversationId: string,
    messageId: string,
    body: string,
    reserve: (messageId: string) => void,
  ): Promise<{ message: MessageView; changed: boolean }> {
    const message = await this.lockOwnMessage(
      author.id,
      conversationId,
      messageId,
    );
    reserve(message.id);
    const changed = message.body !== body;
    if (changed) {
      message.body = body;
      // Estritamente crescente por Mensagem, mesmo com duas edições no mesmo milissegundo: a aba só
      // aceita uma edição com edited_at mais novo (spec da F06, "Eventos no cliente").
      message.editedAt = new Date(
        Math.max(Date.now(), (message.editedAt?.getTime() ?? 0) + 1),
      );
      await this.messages.update(
        { id: message.id },
        { body, editedAt: message.editedAt },
      );
    }
    // O autor é quem pediu: o nome vem da Sessão, sem outra consulta.
    return { message: toView(message, author), changed };
  }

  // A Mensagem do autor, lida com trava de linha. A Conversa sem participação, ou com id
  // malformado, e a Mensagem que não existe ou é de outra Conversa respondem do mesmo jeito, para
  // não revelar qual dos casos; a de outra Pessoa, que o Membro já vê, responde que não é dele.
  private async lockOwnMessage(
    personId: string,
    conversationId: string,
    messageId: string,
  ): Promise<Message> {
    try {
      await this.conversations.getForMember(personId, conversationId);
      // Em série com a remoção de Membro, que trava a Conversa (FOR UPDATE): a participação é
      // conferida de novo sob a trava, e quem foi removido enquanto esperava não muda nada.
      await this.txHost.tx.query(
        'SELECT 1 FROM conversations WHERE id = $1 FOR SHARE',
        [conversationId],
      );
      await this.conversations.getForMember(personId, conversationId);
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        throw new MessageNotFoundError();
      }
      throw error;
    }
    if (!isUUID(messageId)) throw new MessageNotFoundError();
    const message = await this.messages
      .createQueryBuilder('message')
      .setLock('pessimistic_write')
      .where('message.id = :messageId', { messageId })
      .andWhere('message.conversationId = :conversationId', { conversationId })
      .getOne();
    // A apagada responde como a que não existe: editar ou apagar de novo dá 404.
    if (!message || message.deletedAt) throw new MessageNotFoundError();
    if (message.authorId !== personId) throw new MessageNotOwnedError();
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
    // As rotas só devolvem Mensagens vivas, com texto (spec da F06, "Histórico").
    body: message.body ?? '',
    createdAt: message.createdAt,
    editedAt: message.editedAt ?? null,
  };
}
