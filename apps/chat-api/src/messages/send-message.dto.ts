import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { USERNAME_MAX_LENGTH } from '../people/username';
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

  // O @usuário do Agente conectado mencionado, que o BFF reconhece (spec da F11, "Envio e Pergunta
  // pendente"). Um que não é de bot recebe bot_not_found.
  @IsOptional()
  @IsString()
  @MaxLength(USERNAME_MAX_LENGTH)
  agent_username?: string;
}
