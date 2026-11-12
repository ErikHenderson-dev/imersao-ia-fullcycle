import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Bot } from '../bots/bot.entity';
import { Conversation } from '../conversations/conversation.entity';
import { BaseEntity } from '../database/base.entity';
import { Person } from '../people/person.entity';
import { MESSAGE_MAX_LENGTH } from './message-values';

// O id (UUID v7) dá a ordem da Conversa; created_at é a hora mostrada na tela.
@Entity('messages')
@Index('messages_conversation_id_id_idx', ['conversationId', 'id'])
@Unique('messages_author_client_key', ['authorPersonId', 'clientId'])
// O autor é uma Pessoa ou o bot de um Agente, exatamente um (spec da F11, "Autor da Mensagem"); a
// migração AddMessageBotAuthor escreve o mesmo CHECK.
@Check(
  'messages_author_check',
  'num_nonnulls("author_person_id", "author_bot_id") = 1',
)
// Só a Mensagem apagada fica sem texto (spec da F06, "Apagar"); a migração escreve o mesmo CHECK.
@Check(
  'messages_body_check',
  `("deleted_at" IS NULL AND "body" IS NOT NULL AND char_length("body") BETWEEN 1 AND ${MESSAGE_MAX_LENGTH}) OR ("deleted_at" IS NOT NULL AND "body" IS NULL)`,
)
export class Message extends BaseEntity {
  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  // Nulo na Mensagem de bot (ADR 0028).
  @Column({ type: 'uuid', nullable: true })
  authorPersonId!: string | null;

  @ManyToOne(() => Person)
  @JoinColumn({ name: 'author_person_id' })
  authorPerson?: Person;

  // O bot do Agente que gravou a Mensagem, ou nulo na Mensagem de Pessoa.
  @Column({ type: 'uuid', nullable: true })
  authorBotId!: string | null;

  @ManyToOne(() => Bot)
  @JoinColumn({ name: 'author_bot_id' })
  authorBot?: Bot;

  // Identificador gerado no cliente: o reenvio do mesmo autor não duplica (F02-T05).
  @Column({ type: 'uuid' })
  clientId!: string;

  // Nulo só na Mensagem apagada, pelo CHECK do banco (spec da F06, "Apagar").
  @Column({ type: 'text', nullable: true })
  body!: string | null;

  // A hora da última edição que mudou o texto (spec da F06, "Mensagens").
  @Column({ type: 'timestamptz', nullable: true })
  editedAt!: Date | null;

  // A Mensagem citada, da mesma Conversa (spec da F06, "Enviar com Citação").
  @Index('messages_quoted_message_id_idx')
  @Column({ type: 'uuid', nullable: true })
  quotedMessageId!: string | null;

  @ManyToOne(() => Message, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'quoted_message_id' })
  quotedMessage?: Message;

  // Os rótulos das Respostas prontas da pergunta do bot, ou nulo (spec da F11, "Envio e Pergunta
  // pendente"); quem pode responder e até quando vêm da Pergunta pendente da Mensagem.
  @Column({ type: 'jsonb', nullable: true })
  quickReplies!: string[] | null;

  // A hora da exclusão; a linha fica só para as Citações (spec da F06, "Apagar").
  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
