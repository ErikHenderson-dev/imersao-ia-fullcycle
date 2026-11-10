import { Injectable } from '@nestjs/common';
import {
  ConversationsService,
  type ConversationSummary,
} from '../conversations/conversations.service';
import {
  MessagesService,
  type MessageView,
} from '../messages/messages.service';
import { ActivityPublisher } from '../notifications/activity.publisher';
import { ActivityMessageNotFoundError } from './activity-message-not-found.error';
import {
  type ActivityCounts,
  type ActivityFilter,
  type NotificationKind,
  NotificationFinder,
} from '../notifications/notification-finder';

// Um item de Atividade: a Notificação, com a Mensagem e a Conversa dela.
export interface ActivityItem {
  kind: NotificationKind;
  message: MessageView;
  conversation: ConversationSummary;
}

export interface ActivityPage {
  items: ActivityItem[];
  hasMore: boolean;
}

// A Atividade de uma Pessoa (spec da F08, "Notificações e contagem"): a lista e os números saem das
// Notificações calculadas (ADR 0027).
@Injectable()
export class ActivityService {
  constructor(
    private readonly notifications: NotificationFinder,
    private readonly messages: MessagesService,
    private readonly conversations: ConversationsService,
    private readonly publisher: ActivityPublisher,
  ) {}

  async listPage(
    personId: string,
    filter: ActivityFilter,
    page: { before?: string; limit: number },
  ): Promise<ActivityPage> {
    const { notifications, hasMore } = await this.notifications.listPage(
      personId,
      filter,
      page,
    );
    const [messages, conversations] = await Promise.all([
      this.messages.viewsByIds(
        notifications.map((notification) => notification.messageId),
      ),
      this.conversations.summariesByIds([
        ...new Set(
          notifications.map((notification) => notification.conversationId),
        ),
      ]),
    ]);
    const messageById = new Map(
      messages.map((message) => [message.id, message]),
    );
    const conversationById = new Map(
      conversations.map((summary) => [summary.conversation.id, summary]),
    );
    // Uma Mensagem apagada entre as duas leituras fica fora da página.
    const items = notifications.flatMap((notification) => {
      const message = messageById.get(notification.messageId);
      const conversation = conversationById.get(notification.conversationId);
      return message && conversation
        ? [{ kind: notification.kind, message, conversation }]
        : [];
    });
    return { items, hasMore };
  }

  countUnread(personId: string): Promise<ActivityCounts> {
    return this.notifications.countOne(personId);
  }

  // Marca tudo como lido até a Mensagem (spec da F08, "Avançar a marca de Atividade"): só avança, e
  // não mexe na Última leitura de nenhuma Conversa. Uma posição igual ou anterior responde os números
  // atuais, sem publicar; a que avançou publica os números a todas as abas da Pessoa.
  async markRead(personId: string, messageId: string): Promise<ActivityCounts> {
    const { isKnown, advanced } = await this.notifications.advanceMark(
      personId,
      messageId,
    );
    if (!isKnown) throw new ActivityMessageNotFoundError();
    if (advanced) this.publisher.publish([personId]);
    return this.notifications.countOne(personId);
  }
}
