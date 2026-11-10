import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { Person } from '../people/person.entity';
import { Message } from './message.entity';

// Uma Pessoa mencionada numa Mensagem (spec da F06, "Mensagens"): resolvida ao gravar, só para
// Membros da Conversa, e mantida quando a Mensagem é apagada, para a F07 e a F08.
@Entity('message_mentions')
@Unique('message_mentions_message_person_key', ['messageId', 'personId'])
// As Menções de uma Pessoa na ordem das Mensagens: a contagem de Menções Não lidas lê só as
// posteriores à Última leitura (spec da F07, "Última leitura e contagem").
@Index('message_mentions_person_message_idx', ['personId', 'messageId'])
export class MessageMention extends BaseEntity {
  @Column({ type: 'uuid' })
  messageId!: string;

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message?: Message;

  @Column({ type: 'uuid' })
  personId!: string;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person?: Person;
}
