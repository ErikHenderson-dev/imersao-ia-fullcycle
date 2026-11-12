import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BotsService } from '../bots/bots.service';
import { ConversationsService } from '../conversations/conversations.service';
import type { ConversationKind } from '../conversations/conversation.entity';
import { MessagesService } from '../messages/messages.service';
import { PeopleService } from '../people/people.service';
import { AssigneeIsBotError } from './assignee-is-bot.error';
import { AssigneeNotMemberError } from './assignee-not-member.error';
import { Task, TaskStatus } from './task.entity';

export interface NewTask {
  requestId: string;
  conversationId: string;
  triggerMessageId: string;
  assigneeId: string;
  delegatorId: string;
  title: string;
}

export interface TaskPerson {
  id: string;
  name: string;
  username: string;
}

// A Tarefa como as rotas a mostram (spec da F12, "Concluir, reabrir e listar").
export interface TaskView {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: Date;
  completedAt: Date | null;
  assignee: TaskPerson;
  delegator: TaskPerson;
  conversation: { id: string; name: string | null; kind: ConversationKind };
  triggerMessage: { id: string; deleted: boolean };
}

// As Tarefas (spec da F12, "Tarefa"). Quem chama abre a transação: a Tarefa nasce com a confirmação
// do bot, na ação `task`.
@Injectable()
export class TasksService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly conversations: ConversationsService,
    private readonly people: PeopleService,
    private readonly messages: MessagesService,
    private readonly bots: BotsService,
  ) {}

  private get tasks(): Repository<Task> {
    return this.txHost.tx.getRepository(Task);
  }

  // A Pessoa Membro da Conversa com esse @usuário: o Responsável. O bot com o @usuário é procurado
  // só quando não há Membro, para dizer por que a Tarefa foi recusada.
  async resolveAssignee(
    conversationId: string,
    username: string,
  ): Promise<{ id: string; name: string }> {
    const member = await this.conversations.findMemberByUsername(
      conversationId,
      username,
    );
    if (member) return member;
    if (await this.bots.findByUsername(username)) {
      throw new AssigneeIsBotError();
    }
    throw new AssigneeNotMemberError();
  }

  create(task: NewTask): Promise<Task> {
    return this.tasks.save(this.tasks.create(task));
  }

  // A Tarefa que o Pedido criou: quem chama sabe que a ação `task` dele foi gravada.
  findByRequestOrFail(requestId: string): Promise<Task> {
    return this.tasks.findOneByOrFail({ requestId });
  }

  // As Tarefas montadas para as rotas, na mesma ordem, com as Pessoas, a Conversa e se a Mensagem
  // do Pedido foi apagada lidas de uma vez.
  async views(tasks: Task[]): Promise<TaskView[]> {
    if (tasks.length === 0) return [];
    const personIds = [
      ...new Set(tasks.flatMap((task) => [task.assigneeId, task.delegatorId])),
    ];
    const [people, conversations, deleted] = await Promise.all([
      this.people.findByIds(personIds),
      this.conversations.findByIds([
        ...new Set(tasks.map((task) => task.conversationId)),
      ]),
      this.messages.findDeletedIds(tasks.map((task) => task.triggerMessageId)),
    ]);
    const personById = new Map(
      people.map((person) => [
        person.id,
        { id: person.id, name: person.name, username: person.username },
      ]),
    );
    const conversationById = new Map(
      conversations.map((conversation) => [
        conversation.id,
        {
          id: conversation.id,
          name: conversation.name,
          kind: conversation.kind,
        },
      ]),
    );
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      assignee: personById.get(task.assigneeId)!,
      delegator: personById.get(task.delegatorId)!,
      conversation: conversationById.get(task.conversationId)!,
      triggerMessage: {
        id: task.triggerMessageId,
        deleted: deleted.has(task.triggerMessageId),
      },
    }));
  }

  async view(task: Task): Promise<TaskView> {
    const [view] = await this.views([task]);
    return view;
  }
}
