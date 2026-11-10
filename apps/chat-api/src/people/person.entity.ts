import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Message } from '../messages/message.entity';
import { BaseEntity } from '../database/base.entity';
import { PHONE_PATTERN, TITLE_MAX_LENGTH } from './profile-values';
import { USERNAME_PATTERN } from './username';

// Os CHECK ficam também na migração AddPersonProfile, escrita à mão: o TypeORM não percebe a
// mudança na expressão de um CHECK.
@Entity('people')
@Check('people_username_check', `"username" ~ '${USERNAME_PATTERN.source}'`)
@Check(
  'people_title_check',
  `char_length("title") BETWEEN 1 AND ${TITLE_MAX_LENGTH} AND "title" !~ '[\\r\\n]'`,
)
@Check('people_phone_check', `"phone" ~ '${PHONE_PATTERN.source}'`)
@Index('people_username_key', ['username'], { unique: true })
export class Person extends BaseEntity {
  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  passwordHash!: string;

  // O @usuário, único e fixo (spec da F05, "Pessoas").
  @Column({ type: 'text' })
  username!: string;

  // O cargo.
  @Column({ type: 'text', nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  // Fuso IANA do navegador da Pessoa, gravado por ela (F05-T03).
  @Column({ type: 'text', nullable: true })
  timeZone!: string | null;

  // A marca de Atividade: até que Mensagem as Notificações estão lidas por "Marcar tudo como lido"
  // (spec da F08, "Notificações e contagem"). Só avança. A exclusão de Mensagem é lógica, então a
  // referência não tem ação de cascata.
  @Column({ type: 'uuid', nullable: true })
  activityReadMessageId!: string | null;

  @ManyToOne(() => Message)
  @JoinColumn({ name: 'activity_read_message_id' })
  activityReadMessage?: Message;
}
