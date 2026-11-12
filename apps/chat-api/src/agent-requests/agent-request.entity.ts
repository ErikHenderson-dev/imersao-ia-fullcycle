import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Bot } from '../bots/bot.entity';
import { Conversation } from '../conversations/conversation.entity';
import { BaseEntity } from '../database/base.entity';
import { Message } from '../messages/message.entity';
import { Person } from '../people/person.entity';

export type AgentRequestKind = 'new' | 'continuation';
export type AgentRequestStatus = 'open' | 'failed' | 'cancelled';
// Os estados de encerramento, que só o BFF grava (LLD, "Pedido ao agente e Pergunta pendente").
export const CLOSED_STATUSES = ['failed', 'cancelled'] as const;
export type AgentRequestClosedStatus = (typeof CLOSED_STATUSES)[number];

// O Pedido a um Agente (spec da F11, "Pedido e ações de bot"): o id é o identificador de pedido
// que limita as ações do bot (ADR 0011). Os CHECK ficam também na migração AddAgentRequests.
@Entity('agent_requests')
@Index('agent_requests_trigger_message_key', ['triggerMessageId'], {
  unique: true,
})
@Check('agent_requests_kind_check', `"kind" IN ('new', 'continuation')`)
@Check(
  'agent_requests_status_check',
  `"status" IN ('open', 'failed', 'cancelled')`,
)
export class AgentRequest extends BaseEntity {
  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @Column({ type: 'uuid' })
  requesterId!: string;

  @ManyToOne(() => Person)
  @JoinColumn({ name: 'requester_id' })
  requester?: Person;

  @Column({ type: 'uuid' })
  botId!: string;

  @ManyToOne(() => Bot)
  @JoinColumn({ name: 'bot_id' })
  bot?: Bot;

  // A Mensagem do Pedido: uma Mensagem cria no máximo um Pedido.
  @Column({ type: 'uuid' })
  triggerMessageId!: string;

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trigger_message_id' })
  triggerMessage?: Message;

  @Column({ type: 'text' })
  kind!: AgentRequestKind;

  // Na continuação, o Pedido que fez a pergunta (F11-T07).
  @Column({ type: 'uuid', nullable: true })
  parentRequestId!: string | null;

  @ManyToOne(() => AgentRequest)
  @JoinColumn({ name: 'parent_request_id' })
  parentRequest?: AgentRequest;

  @Column({ type: 'text', default: 'open' })
  status!: AgentRequestStatus;

  // Vencido, o Pedido continua `open`, mas recusa as ações do bot (LLD, "Pedido ao agente").
  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
