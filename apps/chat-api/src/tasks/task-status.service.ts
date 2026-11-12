import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Brackets, Repository } from 'typeorm';
import { RealtimePublisher } from '../realtime/realtime.publisher';
import type { ListTasksQuery } from './list-tasks.query';
import { Task, type TaskStatus } from './task.entity';
import { toTaskResponse } from './task.response';
import { TaskNotAssigneeError } from './task-not-assignee.error';
import { TaskNotFoundError } from './task-not-found.error';
import { TasksService, TaskView } from './tasks.service';

// A ordem das listas: as abertas antes das concluídas e, em cada estado, as mais novas primeiro.
const STATUS_RANK: Record<TaskStatus, number> = { open: 0, done: 1 };

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
    const query = this.tasks
      .createQueryBuilder('task')
      .where(`task.${column} = :personId`, { personId })
      .orderBy(`CASE task.status WHEN 'open' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('task.id', 'DESC')
      .limit(limit + 1);
    if (cursor) {
      const [status, id] = cursor.split('.') as [TaskStatus, string];
      const rank = STATUS_RANK[status];
      query.andWhere(
        new Brackets((after) =>
          after
            .where(`CASE task.status WHEN 'open' THEN 0 ELSE 1 END > :rank`, {
              rank,
            })
            .orWhere(
              new Brackets((same) =>
                same
                  .where('task.status = :status', { status })
                  .andWhere('task.id < :id', { id }),
              ),
            ),
        ),
      );
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
    task.status = status;
    task.completedAt = status === 'done' ? new Date() : null;
    return { task: await this.tasks.save(task), changed: true };
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

// O Responsável e quem delegou, uma vez cada: quem recebe os eventos da Tarefa.
export function partiesOf(task: Pick<Task, 'assigneeId' | 'delegatorId'>) {
  return [...new Set([task.assigneeId, task.delegatorId])];
}
