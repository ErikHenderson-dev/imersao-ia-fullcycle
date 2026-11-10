import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { Person } from '../people/person.entity';
import { CHANNEL_NAME_MAX_LENGTH, TOPIC_MAX_LENGTH } from './channel-name';

// Canais e Conversas diretas numa tabela só (ADR 0024). A F02 cria o Canal público, a F04 o
// privado e a F05 a Conversa direta.
export type ConversationKind = 'public_channel' | 'private_channel' | 'direct';

@Entity('conversations')
// O TypeORM não percebe a mudança na expressão de um CHECK: mudar um destes exige escrever a
// migração à mão (como a AddPrivateChannel), porque o migration:generate não a gera.
@Check(
  'conversations_kind_check',
  `"kind" IN ('public_channel', 'private_channel', 'direct')`,
)
// A Conversa direta não tem nome nem Tópico e guarda o par de Pessoas em ordem; os Canais não têm
// par (spec da F05, "Conversa direta").
@Check(
  'conversations_direct_check',
  `("kind" = 'direct' AND "name" IS NULL AND "topic" IS NULL AND "direct_person_low_id" IS NOT NULL AND "direct_person_high_id" IS NOT NULL AND "direct_person_low_id" <= "direct_person_high_id") OR ("kind" <> 'direct' AND "direct_person_low_id" IS NULL AND "direct_person_high_id" IS NULL)`,
)
@Check(
  'conversations_channel_name_check',
  `"kind" NOT IN ('public_channel', 'private_channel') OR "name" IS NOT NULL`,
)
@Check(
  'conversations_name_length_check',
  `char_length("name") BETWEEN 1 AND ${CHANNEL_NAME_MAX_LENGTH}`,
)
@Check(
  'conversations_topic_length_check',
  `char_length("topic") <= ${TOPIC_MAX_LENGTH}`,
)
@Index('conversations_name_key', ['name'], {
  unique: true,
  where: '"name" IS NOT NULL',
})
// Criação pelo produto sem duplicar (LLD, "Concorrência e idempotência"): o mesmo identificador
// gerado no cliente, da mesma Pessoa, é o mesmo Canal.
// Uma Conversa direta por par de Pessoas (ADR 0025).
@Index(
  'conversations_direct_pair_key',
  ['directPersonLowId', 'directPersonHighId'],
  {
    unique: true,
    where: `"kind" = 'direct'`,
  },
)
// Para a exclusão em cascata de uma Pessoa achar as Conversas diretas em que ela é a segunda do par.
@Index('conversations_direct_person_high_idx', ['directPersonHighId'])
@Index('conversations_creator_client_key', ['createdBy', 'clientId'], {
  unique: true,
  where: '"created_by" IS NOT NULL AND "client_id" IS NOT NULL',
})
export class Conversation extends BaseEntity {
  @Column({ type: 'text' })
  kind!: ConversationKind;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  topic!: string | null;

  // Quem criou o Canal pelo produto; os Canais do comando ficam sem.
  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;

  // Só para a chave estrangeira da migração: a relação não é carregada.
  @ManyToOne(() => Person, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: Person;

  // Identificador gerado no cliente na criação pelo produto.
  @Column({ type: 'uuid', nullable: true })
  clientId!: string | null;

  // O par da Conversa direta, com o menor id primeiro; os dois iguais na Conversa consigo mesma.
  @Column({ type: 'uuid', nullable: true })
  directPersonLowId!: string | null;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'direct_person_low_id' })
  directPersonLow?: Person;

  @Column({ type: 'uuid', nullable: true })
  directPersonHighId!: string | null;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'direct_person_high_id' })
  directPersonHigh?: Person;
}
