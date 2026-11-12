import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Message } from '../messages/message.entity';
import { AgentRequest } from './agent-request.entity';

export type BotActionType = 'reply' | 'question';

// Uma ação de bot vale uma vez por Pedido e tipo (LLD, "Concorrência e idempotência", "Ação de
// bot"): a repetição devolve a Mensagem já gravada. O CHECK fica também na migração
// AddAgentRequests.
@Entity('bot_actions')
@Check(
  'bot_actions_action_type_check',
  `"action_type" IN ('reply', 'question')`,
)
export class BotAction {
  @PrimaryColumn('uuid')
  requestId!: string;

  @ManyToOne(() => AgentRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request?: AgentRequest;

  @PrimaryColumn('text')
  actionType!: BotActionType;

  @Column({ type: 'uuid' })
  messageId!: string;

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message?: Message;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
