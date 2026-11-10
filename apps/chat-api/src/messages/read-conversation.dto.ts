import { IsUUID } from 'class-validator';

// A posição da leitura: a Mensagem até onde a Pessoa leu a Conversa (spec da F07, "Rotas").
export class ReadConversationDto {
  @IsUUID()
  message_id!: string;
}
