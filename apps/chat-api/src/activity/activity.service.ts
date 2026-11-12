import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  ConversationsService,
  type ConversationSummary,
} from '../conversations/conversations.service';
import {
  MessagesService,
  type MessageView,
} from '../messages/messages.service';
import { ActivityPublisher } from '../notifications/activity.publisher';
import {
  TasksService,
  type TaskPerson,
  type TaskView,
} from '../tasks/tasks.service';
import type { TaskNotificationKind } from 'chat-events';
import { ActivityMessageNotFoundError } from './activity-message-not-found.error';
import { TaskNotificationNotFoundError } from './task-notification-not-found.error';
import {
  type ActivityCounts,
  type ActivityFilter,
  type NotificationKind,
  NotificationFinder,
} from '../notifications/notification-finder';

// Um item de Atividade: a Notificação, com a Mensagem e a Conversa dela, ou a Notificação de Tarefa,
// com a Tarefa e quem agiu (spec da F12, "Atividade").
export type ActivityItem =
  | {
      kind: Exclude<NotificationKind, 'task'>;
      message: MessageView;
      conversation: ConversationSummary;
    }
  | {
      kind: 'task';
      notification: { id: string; kind: TaskNotificationKind; isRead: boolean };
      task: TaskView;
      actor: TaskPerson;
    };

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
    private readonly tasks: TasksService,
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
    const messageRefs = notifications.filter((ref) => !ref.task);
    const taskRefs = notifications.flatMap((ref) =>
      ref.task ? [{ id: ref.id, ...ref.task }] : [],
    );
    const [messages, conversations, tasks] = await Promise.all([
      this.messages.viewsByIds(messageRefs.map((ref) => ref.id)),
      this.conversations.summariesByIds([
        ...new Set(messageRefs.flatMap((ref) => ref.conversationId ?? [])),
      ]),
      this.tasks.viewsByIds([...new Set(taskRefs.map((ref) => ref.taskId))]),
    ]);
    const messageById = new Map(
      messages.map((message) => [message.id, message]),
    );
    const conversationById = new Map(
      conversations.map((summary) => [summary.conversation.id, summary]),
    );
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    // Uma Mensagem apagada entre as duas leituras fica fora da página.
    const items = notifications.flatMap((ref): ActivityItem[] => {
      if (ref.task) {
        const task = taskById.get(ref.task.taskId);
        if (!task) return [];
        return [
          {
            kind: 'task',
            notification: {
              id: ref.id,
              kind: ref.task.kind,
              isRead: ref.task.isRead,
            },
            task,
            // Quem delegou, na recebida; o Responsável, na concluída e na reaberta.
            actor:
              ref.task.kind === 'received' ? task.delegator : task.assignee,
          },
        ];
      }
      const message = messageById.get(ref.id);
      const conversation =
        ref.conversationId && conversationById.get(ref.conversationId);
      return message && conversation && ref.kind !== 'task'
        ? [{ kind: ref.kind, message, conversation }]
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
  // A posição pode ser a de uma Notificação de Tarefa da Pessoa (spec da F12, "Atividade").
  async markRead(
    personId: string,
    position: { messageId: string } | { taskNotificationId: string },
  ): Promise<ActivityCounts> {
    const { isKnown, advanced } =
      'messageId' in position
        ? await this.notifications.advanceMark(personId, position.messageId)
        : await this.notifications.advanceMarkToTaskNotification(
            personId,
            position.taskNotificationId,
          );
    if (!isKnown) throw new ActivityMessageNotFoundError();
    if (advanced) this.publisher.publish([personId]);
    return this.notifications.countOne(personId);
  }

  // Marca uma Notificação de Tarefa como lida, ao abri-la (ADR 0029). Só a que mudou publica os
  // números às abas da Pessoa.
  async markTaskNotificationRead(
    personId: string,
    notificationId: string,
  ): Promise<void> {
    if (!isUUID(notificationId)) throw new TaskNotificationNotFoundError();
    const { isKnown, changed } =
      await this.notifications.markTaskNotificationRead(
        personId,
        notificationId,
      );
    if (!isKnown) throw new TaskNotificationNotFoundError();
    if (changed) this.publisher.publish([personId]);
  }
}
