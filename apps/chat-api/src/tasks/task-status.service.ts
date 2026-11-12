import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import type { ListTasksQuery } from './list-tasks.query';
import { partiesOf, Task, type TaskStatus } from './task.entity';
import { toTaskResponse } from './task.response';
import { TaskNotAssigneeError } from './task-not-assignee.error';
import { TaskNotFoundError } from './task-not-found.error';
import { TasksService, TaskView } from './tasks.service';

// Listar, concluir e reabrir as Tarefas de uma Pessoa (spec da F12, "Concluir, reabrir e listar").
// Só o Responsável muda o estado; quem não é parte da Tarefa não a vê.
@Injectable()
export class TaskStatusService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly views: TasksService,
    private readonly realtime: RealtimePublisher,
  ) {}

  private get tasks(): Repository<Task> {
    return this.txHost.tx.getRepository(Task);
  }

  // Uma página de Tarefas recebidas ou delegadas, pelo índice da Pessoa, do estado e do id.
  async list(
    personId: string,
    { role, cursor, limit }: ListTasksQuery,
  ): Promise<{ tasks: TaskView[]; nextCursor: string | null }> {
    const column = role === 'assigned' ? 'assignee_id' : 'delegator_id';
    // 'open' vem depois de 'done' como texto: a ordem decrescente de (status, id) põe as abertas
    // primeiro e as mais novas antes, pelo índice da Pessoa, do estado e do id.
    const query = this.tasks
      .createQueryBuilder('task')
      .where(`task.${column} = :personId`, { personId })
      .orderBy('task.status', 'DESC')
      .addOrderBy('task.id', 'DESC')
      .limit(limit + 1);
    if (cursor) {
      const [status, id] = cursor.split('.');
      query.andWhere('(task.status, task.id) < (:status, :id)', { status, id });
    }
    const found = await query.getMany();
    const page = found.slice(0, limit);
    const last = page.at(-1);
    return {
      tasks: await this.views.views(page),
      nextCursor:
        found.length > limit && last ? `${last.status}.${last.id}` : null,
    };
  }

  // A Tarefa, para o Responsável ou quem delegou.
  async get(personId: string, taskId: string): Promise<TaskView> {
    const task = await this.findVisible(personId, taskId);
    return this.views.view(task);
  }

  // Conclui (`done`) ou reabre (`open`) a Tarefa do Responsável. Já no estado pedido, não muda
  // nada nem publica (LLD, "Tarefa").
  async changeStatus(
    personId: string,
    taskId: string,
    status: TaskStatus,
  ): Promise<TaskView> {
    const { task, changed } = await this.saveStatus(personId, taskId, status);
    const view = await this.views.view(task);
    if (changed) {
      void this.realtime.taskUpdated(partiesOf(task), {
        task: toTaskResponse(view),
      });
    }
    return view;
  }

  @Transactional()
  private async saveStatus(
    personId: string,
    taskId: string,
    status: TaskStatus,
  ): Promise<{ task: Task; changed: boolean }> {
    const task = await this.findVisible(personId, taskId, { lock: true });
    if (task.assigneeId !== personId) throw new TaskNotAssigneeError();
    if (task.status === status) return { task, changed: false };
    const completedAt = status === 'done' ? new Date() : null;
    await this.tasks.update({ id: task.id }, { status, completedAt });
    return {
      task: Object.assign(task, { status, completedAt }),
      changed: true,
    };
  }

  private async findVisible(
    personId: string,
    taskId: string,
    { lock = false }: { lock?: boolean } = {},
  ): Promise<Task> {
    if (!isUUID(taskId)) throw new TaskNotFoundError();
    const query = this.tasks
      .createQueryBuilder('task')
      .where('task.id = :taskId', { taskId });
    if (lock) query.setLock('pessimistic_write');
    const task = await query.getOne();
    if (!task || ![task.assigneeId, task.delegatorId].includes(personId)) {
      throw new TaskNotFoundError();
    }
    return task;
  }
}
