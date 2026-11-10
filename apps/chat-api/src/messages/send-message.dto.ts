import { IsOptional, IsUUID } from 'class-validator';
import { EditMessageDto } from './edit-message.dto';

// O envio leva o texto, com as mesmas regras da edição, e o identificador gerado no cliente.
export class SendMessageDto extends EditMessageDto {
  // Identificador gerado no cliente (LLD, "Concorrência e idempotência").
  @IsUUID()
  client_id!: string;

  // A Mensagem citada, da mesma Conversa (spec da F06, "Enviar com Citação").
  @IsOptional()
  @IsUUID()
  quoted_message_id?: string;
}
