import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Conversation } from '../conversations/conversation.entity';
import { BaseEntity } from '../database/base.entity';
import { Person } from '../people/person.entity';
import { MESSAGE_MAX_LENGTH } from './message-values';

// O id (UUID v7) dá a ordem da Conversa; created_at é a hora mostrada na tela.
@Entity('messages')
@Index('messages_conversation_id_id_idx', ['conversationId', 'id'])
@Unique('messages_author_client_key', ['authorId', 'clientId'])
@Check(
  'messages_body_length_check',
  `char_length("body") BETWEEN 1 AND ${MESSAGE_MAX_LENGTH}`,
)
export class Message extends BaseEntity {
  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @Column({ type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => Person)
  @JoinColumn({ name: 'author_id' })
  author?: Person;

  // Identificador gerado no cliente: o reenvio do mesmo autor não duplica (F02-T05).
  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'text' })
  body!: string;

  // A hora da última edição que mudou o texto (spec da F06, "Mensagens").
  @Column({ type: 'timestamptz', nullable: true })
  editedAt!: Date | null;
}
