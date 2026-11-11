import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable, Logger } from '@nestjs/common';
import type {
  MentionPayload,
  MessageAuthorPayload,
  QuotePayload,
} from 'chat-events';
import { randomUUIDv7 } from 'node:crypto';
import { isUUID } from 'class-validator';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import {
  AgentRequestsService,
  AgentRequestView,
  toAgentRequestView,
} from '../agent-requests/agent-requests.service';
import { BotNotFoundError } from '../bots/bot-not-found.error';
import type { Bot } from '../bots/bot.entity';
import { BotsService } from '../bots/bots.service';
import { ConversationNotFoundError } from '../conversations/conversation-not-found.error';
import { ConversationsService } from '../conversations/conversations.service';
import { MembershipsService } from '../memberships/memberships.service';
import { ActivityPublisher } from '../notifications/activity.publisher';
import { PeopleService } from '../people/people.service';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import { ClientIdConflictError } from './client-id-conflict.error';
import { Message } from './message.entity';
import { MessageMention } from './message-mention.entity';
import { extractMentionUsernames } from './mentions';
import { MessageNotFoundError } from './message-not-found.error';
import { MessageNotOwnedError } from './message-not-owned.error';
import { QuotedMessageNotFoundError } from './quoted-message-not-found.error';
import { UnreadPublisher } from './unread.publisher';
import { KeyedSerialQueue } from '../common/queue/keyed-serial-queue';
import { toMessageResponse } from './message.response';

// Quem escreveu a Mensagem, Pessoa ou bot (spec da F11, "Autor da Mensagem").
export type MessageAuthor = MessageAuthorPayload;

// A Pessoa da Sessão que envia ou edita: a gravação como bot é da ação de bot.
export interface PersonAuthor {
  id: string;
  name: string;
  username: string;
}

// Uma Pessoa mencionada (spec da F06, "A Mensagem no REST e nos eventos").
export type MentionView = MentionPayload;

// A Mensagem citada (spec da F06, "A Mensagem no REST e nos eventos").
export type QuoteView = QuotePayload;

export interface MessageView {
  id: string;
  conversationId: string;
  clientId: string;
  author: MessageAuthor;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  mentions: MentionView[];
  quote: QuoteView | null;
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
  quotedMessageId?: string;
  // O @usuário do Agente conectado mencionado, que o BFF reconhece (spec da F11, "Envio e Pergunta
  // pendente"): a Mensagem vira um Pedido.
  agentUsername?: string;
}

// O envio respondido: a Mensagem e o Pedido que ela criou, ou null.
export interface SendResult {
  message: MessageView;
  agentRequest: AgentRequestView | null;
}

export interface SentMessage extends SendResult {
  // Falso quando o client_id já tinha sido gravado: o reenvio não gera evento.
  created: boolean;
  // A Pessoa que virou Membro da Conversa direta com esta Mensagem (a primeira), ou null.
  joinedId: string | null;
}

// O Recorte que o bot lê: `since` inclusivo e `until` exclusivo, e o @usuário de uma Pessoa.
export interface BotReadFilter {
  since?: Date;
  until?: Date;
  authorUsername?: string;
}

// Uma Mensagem de Pessoa como o bot a lê (spec da F11, "Rotas do bot e credencial").
export interface BotReadMessage {
  id: string;
  author: { name: string; username: string };
  body: string;
  createdAt: Date;
}

export interface BotReadPage {
  messages: BotReadMessage[];
  // A contagem do Recorte inteiro, mesmo acima do teto.
  total: number;
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
    private readonly bots: BotsService,
    private readonly agentRequests: AgentRequestsService,
    private readonly publisher: RealtimePublisher,
    private readonly unreadPublisher: UnreadPublisher,
    private readonly memberships: MembershipsService,
    private readonly activityPublisher: ActivityPublisher,
  ) {}

  private get messages(): Repository<Message> {
    return this.txHost.tx.getRepository(Message);
  }

  private get mentions(): Repository<MessageMention> {
    return this.txHost.tx.getRepository(MessageMention);
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
    return { messages: await this.withDetails(page), hasMore };
  }

  // As Mensagens vivas desses ids, montadas como no histórico (autor, Menções e Citação), sem ordem
  // garantida; a que foi apagada ou não existe fica fora. É a Mensagem dos itens de Atividade (spec
  // da F08, "Notificações e contagem", "Versão por Pessoa").
  async viewsByIds(ids: string[]): Promise<MessageView[]> {
    if (ids.length === 0) return [];
    const found = await this.messages.findBy({
      id: In(ids),
      deletedAt: IsNull(),
    });
    return this.withDetails(found);
  }

  // A Mensagem desse id, montada como no histórico, mesmo apagada; quem chama sabe que ela existe.
  async viewById(id: string): Promise<MessageView> {
    const message = await this.messages.findOneByOrFail({ id });
    const [view] = await this.withDetails([message]);
    return view;
  }

  // As Mensagens de Pessoas, não apagadas, do Recorte, da mais antiga para a mais nova: as `limit`
  // mais recentes, e o `total` do Recorte (spec da F11, "Rotas do bot e credencial"). Os limites
  // viram UUIDs v7 de limite, para a consulta usar o índice (conversation_id, id).
  async listForBot(
    conversationId: string,
    { since, until, authorUsername }: BotReadFilter,
    limit: number,
  ): Promise<BotReadPage> {
    const params: unknown[] = [conversationId];
    const conditions = [
      'm.conversation_id = $1',
      'm.author_person_id IS NOT NULL',
      'm.deleted_at IS NULL',
    ];
    if (since) {
      params.push(uuidV7LowerBound(since));
      conditions.push(`m.id >= $${params.length}`);
    }
    if (until) {
      params.push(uuidV7LowerBound(until));
      conditions.push(`m.id < $${params.length}`);
    }
    if (authorUsername !== undefined) {
      params.push(authorUsername);
      conditions.push(`p.username = $${params.length}`);
    }
    const from = `FROM messages m JOIN people p ON p.id = m.author_person_id WHERE ${conditions.join(' AND ')}`;
    // Em sequência: as duas consultas usam a conexão da transação de quem chama.
    const [{ total }] = await this.txHost.tx.query<{ total: number }[]>(
      `SELECT count(*)::int AS total ${from}`,
      params,
    );
    const newestFirst = await this.txHost.tx.query<
      {
        id: string;
        name: string;
        username: string;
        body: string;
        created_at: Date;
      }[]
    >(
      `SELECT m.id, p.name, p.username, m.body, m.created_at ${from}
          ORDER BY m.id DESC LIMIT $${params.length + 1}`,
      [...params, limit],
    );
    return {
      total,
      messages: newestFirst.reverse().map((row) => ({
        id: row.id,
        author: { name: row.name, username: row.username },
        body: row.body,
        createdAt: row.created_at,
      })),
    };
  }

  // Grava a Mensagem de um bot na Conversa de um Pedido (spec da F11, "Rotas do bot e
  // credencial"), dentro da transação de quem chama, que confere o Pedido e a ação. O bot não é
  // Membro: não há Última leitura, Menção nem Citação.
  async insertBotMessage(
    botId: string,
    conversationId: string,
    body: string,
  ): Promise<MessageView> {
    const message = await this.messages.save(
      this.messages.create({
        conversationId,
        authorBotId: botId,
        authorPersonId: null,
        clientId: randomUUIDv7(),
        body,
        quotedMessageId: null,
      }),
    );
    const [bot] = await this.bots.findByIds([botId]);
    // Montada sem reler a linha: a Mensagem de bot não tem Menção nem Citação.
    return toView(message, toAuthor('bot', bot), [], null);
  }

  // Publica a Mensagem de bot gravada, depois do commit: o message.created e as Não lidas dos
  // Membros. Sem Atividade, porque a Mensagem de bot nunca gera Notificação (spec da F11, "Autor da
  // Mensagem"). A falha só vai para o log, como no envio.
  publishBotMessage(message: MessageView): void {
    const { conversationId } = message;
    this.queueForMessage(
      message.id,
      this.toMembers(
        conversationId,
        async (memberIds) => {
          await this.announceCreated(message, memberIds);
        },
        'Falha ao publicar a Mensagem do bot',
      ),
    );
  }

  // Envia a Mensagem: grava e, só quando a gravação é nova, publica o evento para os Membros, depois
  // da gravação (spec da F03, "Eventos por Pessoa e reconexão", "Publicação"). A Mensagem já está
  // gravada quando a publicação falha: o envio responde sucesso e a falha vai para o log, porque um
  // reenvio da Pessoa não publicaria de novo.
  async sendMessage(
    author: PersonAuthor,
    conversationId: string,
    newMessage: NewMessage,
  ): Promise<SendResult> {
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
    const { message, created, joinedId, agentRequest } = sent;
    const own = barrier as Barrier | null;
    if (!created) return { message, agentRequest };
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
        const { unread } = await this.announceCreated(message, memberIds);
        // Os números de Atividade (spec da F08, "Tempo real"): numa Conversa direta, as duas
        // Pessoas; num Canal, o autor, que leu até aqui, e as Pessoas mencionadas.
        this.activityPublisher.publish(
          async () =>
            (await this.conversations.isDirect(conversationId))
              ? memberIds
              : [author.id, ...message.mentions.map((mention) => mention.id)],
          unread,
        );
      })
      .catch((error: unknown) =>
        this.logger.error('Falha ao publicar a Mensagem gravada', error),
      )
      .finally(() => own?.release());
    // A edição e a exclusão desta Mensagem só publicam depois da criação (spec da F06, "Tempo
    // real", "Ordem"): a fila dela nasce aqui, antes de o envio responder.
    this.queueForMessage(message.id, () => publication);
    return { message, agentRequest };
  }

  // O message.created aos Membros e, depois dele, os números de Não lidas deles (spec da F07,
  // "Tempo real"), no envio e na Mensagem de bot. Os números têm fila própria, por Conversa: a fila
  // da Mensagem não espera por eles, e quem chama recebe a publicação deles.
  private async announceCreated(
    message: MessageView,
    memberIds: string[],
  ): Promise<{ unread: Promise<void> }> {
    await this.publisher.messageCreated(memberIds, toMessageResponse(message));
    return {
      unread: this.unreadPublisher.publish(message.conversationId, memberIds),
    };
  }

  // As publicações pendentes de cada Mensagem, em fila: a criação, as edições e a exclusão saem na
  // ordem em que foram gravadas, mesmo publicando depois do commit. A API roda numa instância só.
  private readonly messageQueues = new KeyedSerialQueue();

  private queueForMessage(messageId: string, publish: () => Promise<void>) {
    void this.messageQueues.run(messageId, publish);
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
    author: PersonAuthor,
    conversationId: string,
    messageId: string,
    body: string,
  ): Promise<MessageView> {
    const { message } = await this.withPublication(
      (reserve) => this.edit(author, conversationId, messageId, body, reserve),
      ({ message: edited, changed, mentionChangedIds }) =>
        changed
          ? this.toMembers(
              conversationId,
              async (memberIds) => {
                await this.publisher.messageUpdated(
                  memberIds,
                  toMessageResponse(edited),
                );
                // Só quem entrou ou saiu das Menções e ainda não tinha lido a Mensagem tem os
                // números mudados (spec da F07).
                if (mentionChangedIds.length > 0) {
                  const changed = new Set(mentionChangedIds);
                  // Lida uma vez só, para os dois publicadores.
                  const affected = this.conversations
                    .listMemberIdsReadBefore(
                      conversationId,
                      messageId,
                      author.id,
                    )
                    .then((ids) => ids.filter((id) => changed.has(id)));
                  affected.catch(() => {});
                  const unread = this.unreadPublisher.publish(
                    conversationId,
                    () => affected,
                  );
                  // As Notificações das mesmas Pessoas (spec da F08).
                  this.activityPublisher.publish(() => affected, unread);
                }
              },
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
          async (memberIds) => {
            await this.publisher.messageDeleted(memberIds, {
              conversation_id: conversationId,
              message_id: messageId,
            });
            // Só quem ainda não tinha lido a Mensagem tem os números mudados (spec da F07).
            // Lida uma vez só, para os dois publicadores.
            let unreadIds: Promise<string[]> | undefined;
            const readBefore = () =>
              (unreadIds ??= this.conversations.listMemberIdsReadBefore(
                conversationId,
                messageId,
                personId,
              ));
            const unread = this.unreadPublisher.publish(
              conversationId,
              readBefore,
            );
            // Dessas Pessoas, as que tinham a Mensagem como Notificação (spec da F08): a outra
            // Pessoa da Conversa direta, ou as mencionadas num Canal. As Menções ficam na exclusão.
            this.activityPublisher.publish(async () => {
              const [stillUnread, isDirect, mentions] = await Promise.all([
                readBefore(),
                this.conversations.isDirect(conversationId),
                this.mentionsOf(messageId),
              ]);
              if (isDirect) return stillUnread;
              const mentioned = new Set(mentions.map((mention) => mention.id));
              return stillUnread.filter((id) => mentioned.has(id));
            }, unread);
          },
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
    author: PersonAuthor,
    conversationId: string,
    messageId: string,
    body: string,
    reserve: (messageId: string) => void,
  ): Promise<{
    message: MessageView;
    changed: boolean;
    mentionChangedIds: string[];
  }> {
    const message = await this.lockOwnMessage(
      author.id,
      conversationId,
      messageId,
    );
    reserve(message.id);
    const previousBody = message.body ?? '';
    const changed = previousBody !== body;
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
    // Só regrava as Menções quando os @usuário escritos mudaram, e não a cada correção do texto.
    const previousMentions = await this.mentionsOf(message.id);
    const rewritesMentions = changed && !sameUsernames(previousBody, body);
    const mentions = rewritesMentions
      ? await this.saveMentions(message, body, true)
      : previousMentions;
    // O autor é quem pediu: o nome vem da Sessão, sem outra consulta.
    return {
      message: toView(
        message,
        toAuthor('person', author),
        mentions,
        await this.quoteOf(message),
      ),
      changed,
      mentionChangedIds: rewritesMentions
        ? symmetricDifference(
            previousMentions.map((mention) => mention.id),
            mentions.map((mention) => mention.id),
          )
        : [],
    };
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
    if (message.authorPersonId !== personId) throw new MessageNotOwnedError();
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
    author: PersonAuthor,
    conversationId: string,
    { clientId, body, quotedMessageId, agentUsername }: NewMessage,
    onBarrier: (barrier: Barrier) => void,
  ): Promise<SentMessage> {
    const conversation = await this.conversations.getForMember(
      author.id,
      conversationId,
    );
    // O bot do Agente mencionado, antes de gravar: sem ele, nada é gravado.
    let bot: Bot | null = null;
    if (agentUsername !== undefined) {
      bot = await this.bots.findByUsername(agentUsername);
      if (!bot) throw new BotNotFoundError();
    }
    // O reenvio do mesmo client_id devolve a Mensagem já gravada, sem olhar a Citação nova (spec da
    // F06, "Enviar com Citação"); só o envio novo confere a Citação.
    if (
      quotedMessageId !== undefined &&
      !(await this.messages.existsBy({ authorPersonId: author.id, clientId }))
    ) {
      await this.assertQuotable(conversationId, quotedMessageId);
    }
    const inserted = await this.messages
      .createQueryBuilder()
      .insert()
      .values({
        id: randomUUIDv7(),
        conversationId,
        authorPersonId: author.id,
        clientId,
        body,
        quotedMessageId: quotedMessageId ?? null,
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
          authorPersonId: author.id,
          clientId,
          body,
          quotedMessageId: quotedMessageId ?? null,
          createdAt: row.created_at,
        })
      : await this.messages.findOneByOrFail({
          authorPersonId: author.id,
          clientId,
        });
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
    // Quem escreve leu a Conversa até a própria Mensagem (spec da F07, "Avançar a Última
    // leitura"); o reenvio não muda nada.
    if (row) {
      await this.conversations.advanceLastRead(
        conversationId,
        author.id,
        message.id,
      );
    }
    // Depois da participação da outra Pessoa da Conversa direta: ela já pode ser mencionada.
    const mentions = row
      ? await this.saveMentions(message, body, false)
      : await this.mentionsOf(message.id);
    // A Mensagem nova com a Menção vira Pedido; o reenvio devolve o que ela já criou.
    let agentRequest: AgentRequestView | null = null;
    if (!row) agentRequest = await this.requestOf(message.id);
    else if (bot)
      agentRequest = await this.openRequest(message, author.id, bot);
    return {
      message: toView(
        message,
        toAuthor('person', author),
        mentions,
        await this.quoteOf(message),
      ),
      agentRequest,
      created: Boolean(row),
      joinedId,
    };
  }

  // A Mensagem nova que menciona um Agente vira um Pedido `new`, na mesma transação (spec da F11,
  // "Envio e Pergunta pendente").
  private async openRequest(
    message: Message,
    requesterId: string,
    bot: Bot,
  ): Promise<AgentRequestView> {
    const request = await this.agentRequests.openNew({
      conversationId: message.conversationId,
      requesterId,
      botId: bot.id,
      triggerMessageId: message.id,
    });
    return toAgentRequestView(request, bot.username);
  }

  // O Pedido que a Mensagem reenviada criou, ou null: o reenvio não cria outro.
  private async requestOf(messageId: string): Promise<AgentRequestView | null> {
    const request = await this.agentRequests.findByTriggerMessage(messageId);
    if (!request) return null;
    const [bot] = await this.bots.findByIds([request.botId]);
    return toAgentRequestView(request, bot.username);
  }

  // As Menções da Mensagem pelo texto gravado (spec da F06, "Menções, ao gravar"): os @usuário de
  // Membros da Conversa, numa consulta só. Na edição, grava só a diferença.
  private async saveMentions(
    message: Message,
    body: string,
    replace: boolean,
  ): Promise<MentionView[]> {
    const usernames = extractMentionUsernames(body);
    const mentioned = await this.conversations.findMembersByUsernames(
      message.conversationId,
      usernames,
    );
    const ids = mentioned.map((person) => person.id);
    if (replace) {
      await this.mentions.delete({
        messageId: message.id,
        ...(ids.length > 0 ? { personId: Not(In(ids)) } : {}),
      });
    }
    if (ids.length > 0) {
      await this.mentions
        .createQueryBuilder()
        .insert()
        .values(
          ids.map((personId) => ({
            id: randomUUIDv7(),
            messageId: message.id,
            personId,
          })),
        )
        .orIgnore()
        .execute();
    }
    return sortMentions(mentioned);
  }

  private async mentionsOf(messageId: string): Promise<MentionView[]> {
    return (await this.mentionsByMessage([messageId])).get(messageId) ?? [];
  }

  // As Menções de várias Mensagens, numa consulta pelos ids.
  private async mentionsByMessage(
    messageIds: string[],
  ): Promise<Map<string, MentionView[]>> {
    const byMessage = new Map<string, MentionView[]>();
    if (messageIds.length === 0) return byMessage;
    const rows = await this.txHost.tx.query<
      { message_id: string; id: string; username: string }[]
    >(
      `SELECT mm.message_id, p.id, p.username FROM message_mentions mm
         JOIN people p ON p.id = mm.person_id
        WHERE mm.message_id = ANY($1)`,
      [messageIds],
    );
    for (const row of rows) {
      const list = byMessage.get(row.message_id) ?? [];
      list.push({ id: row.id, username: row.username });
      byMessage.set(row.message_id, list);
    }
    for (const [id, list] of byMessage) byMessage.set(id, sortMentions(list));
    return byMessage;
  }

  // A Citação precisa ser de uma Mensagem viva da mesma Conversa. A linha da original fica travada
  // em modo compartilhado até o commit, em série com a exclusão (que a trava para escrita): uma
  // exclusão não grava no meio deste envio.
  private async assertQuotable(
    conversationId: string,
    quotedMessageId: string,
  ): Promise<void> {
    const quoted = await this.messages
      .createQueryBuilder('message')
      .setLock('pessimistic_read')
      .where('message.id = :quotedMessageId', { quotedMessageId })
      .andWhere('message.conversationId = :conversationId', { conversationId })
      .getOne();
    if (!quoted || quoted.deletedAt) throw new QuotedMessageNotFoundError();
  }

  private async quoteOf(message: Message): Promise<QuoteView | null> {
    if (!message.quotedMessageId) return null;
    return (await this.quotesById([message.quotedMessageId])).get(
      message.quotedMessageId,
    )!;
  }

  // As Mensagens citadas, com o autor e o texto atual, ou só a marca de apagada, numa consulta para
  // as Mensagens e as dos autores.
  private async quotesById(ids: string[]): Promise<Map<string, QuoteView>> {
    const quotes = new Map<string, QuoteView>();
    if (ids.length === 0) return quotes;
    const quoted = await this.messages.findBy({ id: In(ids) });
    const authorOf = await this.authorsOf(quoted);
    for (const message of quoted) {
      quotes.set(
        message.id,
        message.deletedAt
          ? { id: message.id, deleted: true }
          : {
              id: message.id,
              deleted: false,
              author: authorOf(message),
              body: message.body ?? '',
            },
      );
    }
    return quotes;
  }

  // O autor de cada Mensagem, Pessoa ou bot (spec da F11, "Autor da Mensagem"), com uma consulta
  // para as Pessoas e outra para os bots.
  private async authorsOf(
    messages: Message[],
  ): Promise<(message: Message) => MessageAuthor> {
    const idsOf = (pick: (message: Message) => string | null) => [
      ...new Set(messages.flatMap((message) => pick(message) ?? [])),
    ];
    const [people, bots] = await Promise.all([
      this.people.findByIds(idsOf((message) => message.authorPersonId)),
      this.bots.findByIds(idsOf((message) => message.authorBotId)),
    ]);
    const authors = new Map<string, MessageAuthor>([
      ...people.map(
        (person) => [person.id, toAuthor('person', person)] as const,
      ),
      ...bots.map((bot) => [bot.id, toAuthor('bot', bot)] as const),
    ]);
    return (message) =>
      authors.get((message.authorPersonId ?? message.authorBotId)!)!;
  }

  // Os autores, as Menções e as Citações de uma página, numa consulta para cada.
  private async withDetails(messages: Message[]): Promise<MessageView[]> {
    const quotedIds = [
      ...new Set(
        messages.flatMap((message) =>
          message.quotedMessageId ? [message.quotedMessageId] : [],
        ),
      ),
    ];
    const [authorOf, mentions, quotes] = await Promise.all([
      this.authorsOf(messages),
      this.mentionsByMessage(messages.map((message) => message.id)),
      this.quotesById(quotedIds),
    ]);
    return messages.map((message) =>
      toView(
        message,
        authorOf(message),
        mentions.get(message.id) ?? [],
        message.quotedMessageId
          ? (quotes.get(message.quotedMessageId) ?? null)
          : null,
      ),
    );
  }
}

// O menor UUID v7 do instante: os 48 bits do tempo e o resto zerado. Um id é desse instante em
// diante quando é maior ou igual a ele (o banco compara UUIDs byte a byte).
function uuidV7LowerBound(instant: Date): string {
  const hex = instant.getTime().toString(16).padStart(12, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-0000-0000-000000000000`;
}

// O autor no formato da Mensagem.
function toAuthor(
  kind: MessageAuthor['kind'],
  { id, name, username }: PersonAuthor,
): MessageAuthor {
  return { kind, id, name, username };
}

function sameUsernames(before: string, after: string): boolean {
  const previous = extractMentionUsernames(before).sort();
  const next = extractMentionUsernames(after).sort();
  return (
    previous.length === next.length &&
    previous.every((username, index) => username === next[index])
  );
}

// Em ordem de @usuário, para a resposta não depender da ordem do banco.
function sortMentions(mentions: MentionView[]): MentionView[] {
  return mentions.toSorted((a, b) => a.username.localeCompare(b.username));
}

function toView(
  message: Message,
  author: MessageAuthor,
  mentions: MentionView[],
  quote: QuoteView | null,
): MessageView {
  return {
    id: message.id,
    conversationId: message.conversationId,
    clientId: message.clientId,
    author,
    // As rotas só devolvem Mensagens vivas, com texto (spec da F06, "Histórico").
    body: message.body ?? '',
    createdAt: message.createdAt,
    editedAt: message.editedAt ?? null,
    mentions,
    quote,
  };
}

// Os ids que estão em só uma das listas: quem entrou ou saiu das Menções.
function symmetricDifference(before: string[], after: string[]): string[] {
  const [a, b] = [new Set(before), new Set(after)];
  return [
    ...[...a].filter((id) => !b.has(id)),
    ...[...b].filter((id) => !a.has(id)),
  ];
}
