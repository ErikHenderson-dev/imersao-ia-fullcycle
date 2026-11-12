import { Check, Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { NAME_MAX_LENGTH } from '../people/profile-values';
import { USERNAME_PATTERN } from '../people/username';

// O bot de um Agente (ADR 0028; spec da F10, "Bots"): reserva o @usuário dele, que é o slug do
// catálogo. Os CHECK são os de `people` e ficam também na migração AddBots, escrita à mão.
@Entity('bots')
@Check('bots_username_check', `"username" ~ '${USERNAME_PATTERN.source}'`)
@Check(
  'bots_name_check',
  `char_length("name") BETWEEN 1 AND ${NAME_MAX_LENGTH} AND "name" !~ '[\\r\\n]'`,
)
@Index('bots_username_key', ['username'], { unique: true })
export class Bot extends BaseEntity {
  @Column({ type: 'text' })
  username!: string;

  @Column({ type: 'text' })
  name!: string;
}
