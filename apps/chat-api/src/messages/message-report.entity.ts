import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { REPORT_FILE_NAME_MAX_LENGTH } from './message-values';

// A referência ao PDF de uma Mensagem de entrega do Relatório (spec da F14, "Referência ao PDF e
// download"): a chave no armazenamento de objetos nunca sai da API. Os CHECK ficam também na
// migração AddMessageReports.
@Entity('message_reports')
@Check('message_reports_storage_key_check', `"storage_key" LIKE 'reports/%'`)
@Check(
  'message_reports_file_name_check',
  `char_length("file_name") BETWEEN 5 AND ${REPORT_FILE_NAME_MAX_LENGTH} AND "file_name" LIKE '%.pdf'`,
)
@Check('message_reports_size_bytes_check', `"size_bytes" > 0`)
export class MessageReport {
  @PrimaryColumn('uuid')
  messageId!: string;

  @OneToOne(() => Message, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message?: Message;

  @Column({ type: 'text' })
  storageKey!: string;

  @Column({ type: 'text' })
  fileName!: string;

  @Column({ type: 'integer' })
  sizeBytes!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
