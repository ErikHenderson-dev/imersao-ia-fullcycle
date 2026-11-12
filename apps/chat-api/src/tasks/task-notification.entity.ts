import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { TaskNotificationKind } from 'chat-events';
import { BaseEntity } from '../database/base.entity';
import { Person } from '../people/person.entity';
import { Task } from './task.entity';

// A Notificação de Tarefa, gravada uma por destinatário na transação da mudança da Tarefa (ADR
// 0029; spec da F12, "Tarefa"). O CHECK fica também na migração AddTaskNotifications.
@Entity('task_notifications')
@Index('task_notifications_recipient_idx', ['recipientId', 'id'])
@Index('task_notifications_task_idx', ['taskId'])
@Check(
  'task_notifications_kind_check',
  `"kind" IN ('received', 'completed', 'reopened')`,
)
export class TaskNotification extends BaseEntity {
  @Column({ type: 'uuid' })
  taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: Task;

  @Column({ type: 'uuid' })
  recipientId!: string;

  @ManyToOne(() => Person)
  @JoinColumn({ name: 'recipient_id' })
  recipient?: Person;

  @Column({ type: 'text' })
  kind!: TaskNotificationKind;

  // Quando a Pessoa a abriu; nula enquanto não abriu.
  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;
}
