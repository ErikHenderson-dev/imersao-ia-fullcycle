import { IsUUID } from 'class-validator';
import { EditMessageDto } from './edit-message.dto';

// O envio leva o texto, com as mesmas regras da edição, e o identificador gerado no cliente.
export class SendMessageDto extends EditMessageDto {
  // Identificador gerado no cliente (LLD, "Concorrência e idempotência").
  @IsUUID()
  client_id!: string;
}
