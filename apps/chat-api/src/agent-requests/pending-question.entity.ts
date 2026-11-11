import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Bot } from '../bots/bot.entity';
import { Conversation } from '../conversations/conversation.entity';
import { BaseEntity } from '../database/base.entity';
import { Message } from '../messages/message.entity';
import { Person } from '../people/person.entity';
import { AgentRequest } from './agent-request.entity';

// A pergunta do bot que espera a resposta de quem pediu (spec da F11, "Envio e Pergunta pendente"):
// uma aberta por Pessoa e Conversa, e uma por Mensagem. Vencida, se reconhece pelo `expires_at`.
@Entity('pending_questions')
@Index('pending_questions_open_key', ['conversationId', 'personId'], {
  unique: true,
  where: '"closed_at" IS NULL',
})
@Index('pending_questions_question_message_key', ['questionMessageId'], {
  unique: true,
})
export class PendingQuestion extends BaseEntity {
  // O Pedido que perguntou: a continuação aponta para ele.
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

  // Quem pediu: só a Mensagem dela responde à pergunta.
  @Column({ type: 'uuid' })
  personId!: string;

  @ManyToOne(() => Person)
  @JoinColumn({ name: 'person_id' })
  person?: Person;

  @Column({ type: 'uuid' })
  botId!: string;

  @ManyToOne(() => Bot)
  @JoinColumn({ name: 'bot_id' })
  bot?: Bot;

  @Column({ type: 'uuid' })
  questionMessageId!: string;

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_message_id' })
  questionMessage?: Message;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;
}
