import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AgentRequest } from '../agent-requests/agent-request.entity';
import { Conversation } from '../conversations/conversation.entity';
import { BaseEntity } from '../database/base.entity';
import { Message } from '../messages/message.entity';
import { Person } from '../people/person.entity';
import { TASK_TITLE_MAX_LENGTH } from './task-values';

export type TaskStatus = 'open' | 'done';

// A Tarefa que um Agente delega a um Membro da Conversa do Pedido (spec da F12, "Tarefa"). Um
// Pedido cria no máximo uma. Os CHECK ficam também na migração AddTasks.
@Entity('tasks')
@Index('tasks_request_key', ['requestId'], { unique: true })
@Index('tasks_assignee_idx', ['assigneeId', 'status', 'id'])
@Index('tasks_delegator_idx', ['delegatorId', 'status', 'id'])
@Check('tasks_status_check', `"status" IN ('open', 'done')`)
@Check(
  'tasks_title_check',
  `char_length("title") BETWEEN 1 AND ${TASK_TITLE_MAX_LENGTH}`,
)
export class Task extends BaseEntity {
  @Column({ type: 'uuid' })
  requestId!: string;

  @ManyToOne(() => AgentRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request?: AgentRequest;

  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  // A Mensagem do Pedido, que o link da Tarefa abre.
  @Column({ type: 'uuid' })
  triggerMessageId!: string;

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trigger_message_id' })
  triggerMessage?: Message;

  // O Responsável.
  @Column({ type: 'uuid' })
  assigneeId!: string;

  @ManyToOne(() => Person)
  @JoinColumn({ name: 'assignee_id' })
  assignee?: Person;

  // Quem delegou: quem fez o Pedido.
  @Column({ type: 'uuid' })
  delegatorId!: string;

  @ManyToOne(() => Person)
  @JoinColumn({ name: 'delegator_id' })
  delegator?: Person;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', default: 'open' })
  status!: TaskStatus;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
